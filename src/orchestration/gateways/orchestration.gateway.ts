import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../auth/auth.service';
import { 
  ConnectionStatusEvent, 
  ErrorEvent, 
  ORCHESTRATION_EVENTS,
  OrderStatusChangedEvent,
  PaymentSucceededEvent,
  PaymentFailedEvent,
  OrderCompensationEvent
} from '../../common/events/types';

/**
 * 用户连接信息接口
 */
interface ConnectedUser {
  id: string;
  email: string;
  role: string;
  clinicId?: string;
  lastActivity: Date;
}

/**
 * 连接指标接口
 */
interface ConnectionMetrics {
  activeConnections: number;
  totalConnectionAttempts: number;
  totalEvents: number;
  errorRate: number;
  timestamp: string;
}

/**
 * 增强的监控指标接口
 */
interface EnhancedMetrics {
  connectionMetrics: {
    averageConnectionDuration: number;
    totalConnectionTime: number;
    currentConnections: number;
    peakConnections: number;
  };
  messageMetrics: {
    totalMessagesSent: number;
    messagesPerSecond: number;
    messagesByEvent: Record<string, number>;
  };
  roomMetrics: {
    totalRooms: number;
    averageClientsPerRoom: number;
    largestRoom: number;
  };
  slidingWindowMetrics: {
    last1MinuteMessages: number;
    last5MinuteMessages: number;
    last1MinuteErrors: number;
  };
  errorMetrics: {
    connectionErrors: number;
    authenticationErrors: number;
    messageDeliveryFailures: number;
  };
  performanceMetrics: {
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
  };
}

/**
 * 业务编排WebSocket网关
 * 
 * 职责：
 * - 处理WebSocket连接与断开
 * - JWT认证
 * - 事件广播
 * - 连接状态管理
 * 
 * 安全机制：
 * - 基于JWT的连接认证
 * - 用户级别的连接隔离
 * - 连接池管理
 */
@WebSocketGateway({
  path: '/ws/orchestration',
  cors: { 
      origin: process.env.CLIENT_URL || [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:3004',
        'http://localhost:3005',
        'http://localhost:3006',
        'http://localhost:3007',
        'http://localhost:3008',
        'http://localhost:3009'
      ]
    },
  transports: ['websocket', 'polling'], // 支持WebSocket和长轮询
})
@Injectable()
export class OrchestrationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(OrchestrationGateway.name);
  private readonly connectedClients = new Map<string, Socket>();
  private readonly connectedUsers = new Map<string, ConnectedUser>();
  
  // 监控指标
  private connectionCounter = 0;
  private eventCounter = 0;
  private errorCounter = 0;
  private lastMetricsTime = Date.now();
  private readonly metricsInterval = 60000; // 每分钟记录一次指标
  private readonly maxRetries = 5; // 最大重试次数
  private readonly reconnectDelay = 1000; // 初始重连延迟（毫秒）
  
  // 增强的监控指标
  private connectionTimes = new Map<string, number>(); // 用户ID -> 连接时间戳
  private peakConnections = 0;
  private messagesSentCount = 0;
  private messagesByEvent = new Map<string, number>();
  private rooms = new Map<string, Set<string>>(); // 房间ID -> 用户ID集合
  private messageTimestamps: number[] = [];
  private errorTimestamps: number[] = [];
  private authErrors = 0;
  private messageDeliveryFailures = 0;
  private messageLatencies: number[] = [];

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 处理新的WebSocket连接
   * 
   * 流程：
   * 1. 从握手auth对象获取JWT token
   * 2. 验证token有效性
   * 3. 获取用户信息
   * 4. 存储连接信息
   * 5. 发送连接成功事件
   * 
   * 错误处理：
   * - 无token：关闭连接并发送错误事件
   * - token无效：关闭连接并发送错误事件
   * - 用户不存在：关闭连接并发送错误事件
   */
  async handleConnection(client: Socket) {
    try {
      this.connectionCounter++;
      this.logger.log(`New WebSocket connection attempt: ${client.id}`);
      
      // 从handshake auth中获取token
      const token = client.handshake.auth.token;
      if (!token) {
        throw new UnauthorizedException('Missing authentication token');
      }

      // 验证JWT token
      let payload;
      try {
        payload = this.jwtService.verify(token);
      } catch (error) {
        throw new UnauthorizedException(`Invalid token: ${error.message}`);
      }
      
      // 验证用户
      const user = await this.authService.verifyPayload(payload);
      if (!user) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // 存储client连接信息
      client.data.user = user;
      
      // 如果同一用户已有连接，先断开旧连接
      const existingClient = this.connectedClients.get(user.id);
      if (existingClient) {
        this.logger.log(`Disconnecting previous connection for user: ${user.id}`);
        existingClient.disconnect();
      }
      
      // 存储连接信息
      this.connectedClients.set(user.id, client);
      this.connectedUsers.set(user.id, {
        ...user,
        lastActivity: new Date()
      });
      
      // 记录连接时间和峰值
      this.connectionTimes.set(user.id, Date.now());
      if (this.connectedClients.size > this.peakConnections) {
        this.peakConnections = this.connectedClients.size;
      }
      
      this.logger.log(`Client connected: ${user.id} (${this.connectedClients.size} active connections)`);
      
      // 发送连接状态事件
      const connectionEvent: ConnectionStatusEvent = {
        connected: true,
        userId: user.id,
        timestamp: new Date().toISOString()
      };
      client.emit(ORCHESTRATION_EVENTS.CONNECTION_STATUS, connectionEvent);
      
      // 设置ping/pong保活
      client.conn.on('heartbeat', () => {
        if (user && this.connectedUsers.has(user.id)) {
          const userInfo = this.connectedUsers.get(user.id);
          if (userInfo) {
            userInfo.lastActivity = new Date();
          }
        }
      });
      
      // 记录指标
      this.recordMetrics();
      
    } catch (error) {
      this.errorCounter++;
      this.recordError();
      
      // 记录认证错误
      if (error instanceof UnauthorizedException) {
        this.authErrors++;
      }
      
      this.logger.error(`Connection error: ${error.message}`);
      
      // 发送错误事件
      const errorEvent: ErrorEvent = {
        message: 'Authentication failed',
        code: error.name || 'AUTH_ERROR',
        timestamp: new Date().toISOString()
      };
      client.emit(ORCHESTRATION_EVENTS.ERROR, errorEvent);
      
      // 断开连接
      client.disconnect();
    }
  }

  /**
   * 处理WebSocket断开连接
   * 
   * 流程：
   * 1. 从连接信息获取用户ID
   * 2. 从连接池中移除连接
   * 3. 记录日志
   */
  handleDisconnect(client: Socket) {
    const userId = client.data?.user?.id;
    if (userId) {
      // 记录连接时长
      const connectionStartTime = this.connectionTimes.get(userId);
      if (connectionStartTime) {
        const connectionDuration = Date.now() - connectionStartTime;
        this.connectionTimes.delete(userId);
        this.logger.debug(`Connection duration for user ${userId}: ${connectionDuration}ms`);
      }

      // 从房间中移除用户
      for (const [roomId, userIds] of this.rooms.entries()) {
        if (userIds.has(userId)) {
          userIds.delete(userId);
          if (userIds.size === 0) {
            this.rooms.delete(roomId);
          }
        }
      }

      this.connectedClients.delete(userId);
      this.connectedUsers.delete(userId);
      this.logger.log(`Client disconnected: ${userId} (${this.connectedClients.size} active connections)`);
    } else {
      this.logger.log(`Unauthenticated client disconnected: ${client.id}`);
    }
    
    // 记录指标
    this.recordMetrics();
  }

  /**
   * 广播事件到所有连接的客户端
   * 
   * @param eventName 事件名称
   * @param data 事件数据
   */
  broadcastEvent<T>(eventName: string, data: T) {
    const startTime = Date.now();
    
    this.eventCounter++;
    this.messagesSentCount++;
    
    // 记录事件类型统计
    const currentCount = this.messagesByEvent.get(eventName) || 0;
    this.messagesByEvent.set(eventName, currentCount + 1);
    
    // 记录消息时间戳（用于滑动窗口统计）
    this.messageTimestamps.push(Date.now());
    this.cleanOldTimestamps();
    
    this.server.emit(eventName, data);
    
    // 记录消息延迟
    const latency = Date.now() - startTime;
    this.messageLatencies.push(latency);
    this.cleanOldLatencies();
    
    this.logger.debug(`Broadcasting event ${eventName}: ${JSON.stringify(data)}`);
  }

  /**
   * 发送订单状态变更事件
   * 
   * @param event 订单状态变更事件
   */
  broadcastOrderStatusChanged(event: OrderStatusChangedEvent) {
    this.broadcastEvent(ORCHESTRATION_EVENTS.ORDER_STATUS_UPDATED, event);
  }
  
  /**
   * 发送支付成功事件
   * 
   * @param event 支付成功事件
   */
  broadcastPaymentSucceeded(event: PaymentSucceededEvent) {
    this.broadcastEvent(ORCHESTRATION_EVENTS.PAYMENT_SUCCEEDED, event);
  }
  
  /**
   * 发送支付失败事件
   * 
   * @param event 支付失败事件
   */
  broadcastPaymentFailed(event: PaymentFailedEvent) {
    this.broadcastEvent(ORCHESTRATION_EVENTS.PAYMENT_FAILED, event);
  }
  
  /**
   * 发送订单补偿事件
   * 
   * @param event 订单补偿事件
   */
  broadcastOrderCompensation(event: OrderCompensationEvent) {
    this.broadcastEvent(ORCHESTRATION_EVENTS.ORDER_COMPENSATION, event);
  }

  /**
   * 发送事件到特定用户
   * 
   * @param userId 用户ID
   * @param eventName 事件名称
   * @param data 事件数据
   * @returns 是否发送成功
   */
  sendToUser<T>(userId: string, eventName: string, data: T): boolean {
    const startTime = Date.now();
    const client = this.connectedClients.get(userId);
    
    if (client) {
      this.eventCounter++;
      this.messagesSentCount++;
      
      // 记录事件类型统计
      const currentCount = this.messagesByEvent.get(eventName) || 0;
      this.messagesByEvent.set(eventName, currentCount + 1);
      
      // 记录消息时间戳
      this.messageTimestamps.push(Date.now());
      this.cleanOldTimestamps();
      
      try {
        client.emit(eventName, data);
        
        // 记录消息延迟
        const latency = Date.now() - startTime;
        this.messageLatencies.push(latency);
        this.cleanOldLatencies();
        
        this.logger.debug(`Sent event ${eventName} to user ${userId}`);
        
        // 更新最后活动时间
        const userInfo = this.connectedUsers.get(userId);
        if (userInfo) {
          userInfo.lastActivity = new Date();
        }
        
        return true;
      } catch (error) {
        this.messageDeliveryFailures++;
        this.logger.error(`Failed to deliver message to user ${userId}: ${error.message}`);
        return false;
      }
    }
    
    this.messageDeliveryFailures++;
    this.logger.warn(`Failed to send event ${eventName} to user ${userId}: User not connected`);
    return false;
  }
  
  /**
   * 发送事件到特定诊所的所有用户
   * 
   * @param clinicId 诊所ID
   * @param eventName 事件名称
   * @param data 事件数据
   * @returns 发送成功的用户数量
   */
  sendToClinic<T>(clinicId: string, eventName: string, data: T): number {
    let sentCount = 0;
    
    // 找到所有属于该诊所的用户
    for (const [userId, userInfo] of this.connectedUsers.entries()) {
      if (userInfo.clinicId === clinicId) {
        if (this.sendToUser(userId, eventName, data)) {
          sentCount++;
        }
      }
    }
    
    this.logger.debug(`Sent event ${eventName} to ${sentCount} users in clinic ${clinicId}`);
    return sentCount;
  }
  
  /**
   * 发送事件到特定角色的所有用户
   * 
   * @param role 角色名称
   * @param eventName 事件名称
   * @param data 事件数据
   * @returns 发送成功的用户数量
   */
  sendToRole<T>(role: string, eventName: string, data: T): number {
    let sentCount = 0;
    
    // 找到所有具有该角色的用户
    for (const [userId, userInfo] of this.connectedUsers.entries()) {
      if (userInfo.role === role) {
        if (this.sendToUser(userId, eventName, data)) {
          sentCount++;
        }
      }
    }
    
    this.logger.debug(`Sent event ${eventName} to ${sentCount} users with role ${role}`);
    return sentCount;
  }
  
  /**
   * 获取连接数量
   * 
   * @returns 当前活跃连接数
   */
  getConnectionCount(): number {
    return this.connectedClients.size;
  }
  
  /**
   * 获取用户连接状态
   * 
   * @param userId 用户ID
   * @returns 用户是否已连接
   */
  isUserConnected(userId: string): boolean {
    return this.connectedClients.has(userId);
  }
  
  /**
   * 获取诊所连接用户数
   * 
   * @param clinicId 诊所ID
   * @returns 连接用户数
   */
  getClinicConnectionCount(clinicId: string): number {
    let count = 0;
    for (const userInfo of this.connectedUsers.values()) {
      if (userInfo.clinicId === clinicId) {
        count++;
      }
    }
    return count;
  }
  
  /**
   * 健康检查方法
   * 
   * @returns 网关是否健康
   */
  isHealthy(): boolean {
    return !!(this.server && this.server.engine && this.server.engine.clientsCount >= 0);
  }
  
  /**
   * 获取监控指标
   * 
   * @returns 监控指标对象
   */
  getMetrics(): ConnectionMetrics {
    return {
      activeConnections: this.connectedClients.size,
      totalConnectionAttempts: this.connectionCounter,
      totalEvents: this.eventCounter,
      errorRate: this.errorCounter > 0 ? 
        (this.errorCounter / (this.connectionCounter || 1)) * 100 : 0,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 获取详细监控指标
   * 
   * @returns 详细监控指标
   */
  getDetailedMetrics() {
    const roleDistribution = new Map<string, number>();
    const clinicDistribution = new Map<string, number>();
    
    // 计算角色和诊所分布
    for (const userInfo of this.connectedUsers.values()) {
      // 角色分布
      const roleCount = roleDistribution.get(userInfo.role) || 0;
      roleDistribution.set(userInfo.role, roleCount + 1);
      
      // 诊所分布
      if (userInfo.clinicId) {
        const clinicCount = clinicDistribution.get(userInfo.clinicId) || 0;
        clinicDistribution.set(userInfo.clinicId, clinicCount + 1);
      }
    }
    
    return {
      ...this.getMetrics(),
      roleDistribution: Object.fromEntries(roleDistribution),
      clinicDistribution: Object.fromEntries(clinicDistribution),
      inactiveConnections: this.getInactiveConnectionsCount(),
    };
  }
  
  /**
   * 获取不活跃连接数量（超过15分钟无活动）
   * 
   * @returns 不活跃连接数量
   */
  private getInactiveConnectionsCount(): number {
    const now = new Date();
    const inactiveThreshold = 15 * 60 * 1000; // 15分钟
    let inactiveCount = 0;
    
    for (const userInfo of this.connectedUsers.values()) {
      const timeSinceLastActivity = now.getTime() - userInfo.lastActivity.getTime();
      if (timeSinceLastActivity > inactiveThreshold) {
        inactiveCount++;
      }
    }
    
    return inactiveCount;
  }
  
  /**
   * 记录监控指标
   */
  private recordMetrics() {
    const now = Date.now();
    if (now - this.lastMetricsTime > this.metricsInterval) {
      this.logger.log(`WebSocket metrics: ${JSON.stringify(this.getMetrics())}`);
      this.lastMetricsTime = now;
    }
  }

  /**
   * 加入房间
   * 
   * @param userId 用户ID
   * @param roomId 房间ID
   */
  joinRoom(userId: string, roomId: string): boolean {
    if (!this.connectedClients.has(userId)) {
      return false;
    }

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    
    this.rooms.get(roomId)!.add(userId);
    this.logger.debug(`User ${userId} joined room ${roomId}`);
    return true;
  }

  /**
   * 离开房间
   * 
   * @param userId 用户ID
   * @param roomId 房间ID
   */
  leaveRoom(userId: string, roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (room && room.has(userId)) {
      room.delete(userId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
      this.logger.debug(`User ${userId} left room ${roomId}`);
      return true;
    }
    return false;
  }

  /**
   * 发送消息到房间
   * 
   * @param roomId 房间ID
   * @param eventName 事件名称
   * @param data 事件数据
   * @returns 发送成功的用户数量
   */
  sendToRoom<T>(roomId: string, eventName: string, data: T): number {
    const room = this.rooms.get(roomId);
    if (!room) {
      return 0;
    }

    let sentCount = 0;
    for (const userId of room) {
      if (this.sendToUser(userId, eventName, data)) {
        sentCount++;
      }
    }

    this.logger.debug(`Sent event ${eventName} to ${sentCount} users in room ${roomId}`);
    return sentCount;
  }

  /**
   * 获取增强的监控指标
   * 
   * @returns 增强监控指标
   */
  getEnhancedMetrics(): EnhancedMetrics {
    const now = Date.now();
    
    // 计算连接时长统计
    let totalConnectionTime = 0;
    let connectionCount = 0;
    for (const [userId, startTime] of this.connectionTimes.entries()) {
      if (this.connectedClients.has(userId)) {
        totalConnectionTime += now - startTime;
        connectionCount++;
      }
    }
    const averageConnectionDuration = connectionCount > 0 ? totalConnectionTime / connectionCount : 0;

    // 计算消息发送速率
    const oneMinuteAgo = now - 60000;
    const fiveMinutesAgo = now - 300000;
    
    const last1MinuteMessages = this.messageTimestamps.filter(ts => ts > oneMinuteAgo).length;
    const last5MinuteMessages = this.messageTimestamps.filter(ts => ts > fiveMinutesAgo).length;
    const last1MinuteErrors = this.errorTimestamps.filter(ts => ts > oneMinuteAgo).length;
    
    const messagesPerSecond = last1MinuteMessages / 60;

    // 计算房间统计
    const totalRooms = this.rooms.size;
    let totalClientsInRooms = 0;
    let largestRoom = 0;
    
    for (const room of this.rooms.values()) {
      totalClientsInRooms += room.size;
      if (room.size > largestRoom) {
        largestRoom = room.size;
      }
    }
    
    const averageClientsPerRoom = totalRooms > 0 ? totalClientsInRooms / totalRooms : 0;

    // 计算性能百分位数
    const sortedLatencies = [...this.messageLatencies].sort((a, b) => a - b);
    const p50Index = Math.floor(sortedLatencies.length * 0.5);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    return {
      connectionMetrics: {
        averageConnectionDuration,
        totalConnectionTime,
        currentConnections: this.connectedClients.size,
        peakConnections: this.peakConnections,
      },
      messageMetrics: {
        totalMessagesSent: this.messagesSentCount,
        messagesPerSecond,
        messagesByEvent: Object.fromEntries(this.messagesByEvent),
      },
      roomMetrics: {
        totalRooms,
        averageClientsPerRoom,
        largestRoom,
      },
      slidingWindowMetrics: {
        last1MinuteMessages,
        last5MinuteMessages,
        last1MinuteErrors,
      },
      errorMetrics: {
        connectionErrors: this.errorCounter,
        authenticationErrors: this.authErrors,
        messageDeliveryFailures: this.messageDeliveryFailures,
      },
      performanceMetrics: {
        p50Latency: sortedLatencies[p50Index] || 0,
        p95Latency: sortedLatencies[p95Index] || 0,
        p99Latency: sortedLatencies[p99Index] || 0,
      },
    };
  }

  /**
   * 重置峰值连接数
   */
  resetPeakConnections(): void {
    this.peakConnections = this.connectedClients.size;
    this.logger.log('Peak connections counter reset');
  }

  /**
   * 清理旧的时间戳数据（保留最近5分钟）
   */
  private cleanOldTimestamps(): void {
    const fiveMinutesAgo = Date.now() - 300000;
    this.messageTimestamps = this.messageTimestamps.filter(ts => ts > fiveMinutesAgo);
    this.errorTimestamps = this.errorTimestamps.filter(ts => ts > fiveMinutesAgo);
  }

  /**
   * 清理旧的延迟数据（保留最近1000条）
   */
  private cleanOldLatencies(): void {
    if (this.messageLatencies.length > 1000) {
      this.messageLatencies = this.messageLatencies.slice(-1000);
    }
  }

  /**
   * 记录错误时间戳
   */
  private recordError(): void {
    this.errorTimestamps.push(Date.now());
    this.cleanOldTimestamps();
  }
} 