import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EventLog, EventProcessingStatus } from "@prisma/client";

/**
 * 事件持久化数据接口
 */
export interface EventPersistenceData {
  eventType: string;
  eventId?: string;
  payload: any;
  metadata?: any;
}

/**
 * 事件查询过滤器接口
 */
export interface EventQueryFilters {
  eventType?: string;
  processingStatus?: EventProcessingStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * 事件统计接口
 */
export interface EventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByStatus: Record<EventProcessingStatus, number>;
}

/**
 * 事件持久化服务
 *
 * 负责将业务编排服务的事件持久化到数据库中，
 * 提供事件查询、统计和管理功能
 */
@Injectable()
export class EventPersistenceService {
  private readonly logger = new Logger(EventPersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 持久化单个事件
   *
   * @param eventData 事件数据
   * @returns 创建的事件日志记录
   */
  async persistEvent(eventData: EventPersistenceData): Promise<EventLog> {
    this.logger.debug(`Persisting event: ${eventData.eventType}`);

    try {
      const eventLog = await this.prisma.eventLog.create({
        data: {
          eventType: eventData.eventType,
          eventId: eventData.eventId,
          payload: eventData.payload,
          metadata: eventData.metadata,
          processingStatus: EventProcessingStatus.PENDING,
        },
      });

      this.logger.debug(`Event persisted successfully: ${eventLog.id}`);
      return eventLog;
    } catch (error) {
      this.logger.error(
        `Failed to persist event: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 批量持久化事件
   *
   * @param eventsData 事件数据数组
   * @returns 批量创建结果
   */
  async persistEventsBatch(
    eventsData: EventPersistenceData[],
  ): Promise<{ count: number }> {
    if (eventsData.length === 0) {
      return { count: 0 };
    }

    this.logger.debug(`Persisting ${eventsData.length} events in batch`);

    try {
      const result = await this.prisma.eventLog.createMany({
        data: eventsData.map((event) => ({
          eventType: event.eventType,
          eventId: event.eventId,
          payload: event.payload,
          metadata: event.metadata,
          processingStatus: EventProcessingStatus.PENDING,
        })),
      });

      this.logger.debug(`Batch persisted ${result.count} events successfully`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to persist events batch: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 查询事件列表
   *
   * @param filters 查询过滤器
   * @returns 事件列表
   */
  async getEvents(filters: EventQueryFilters = {}): Promise<EventLog[]> {
    const {
      eventType,
      processingStatus,
      startDate,
      endDate,
      page = 1,
      limit = 100,
    } = filters;

    this.logger.debug(
      `Querying events with filters: ${JSON.stringify(filters)}`,
    );

    try {
      // 构建查询条件
      const where: any = {};

      if (eventType) {
        where.eventType = eventType;
      }

      if (processingStatus) {
        where.processingStatus = processingStatus;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      const events = await this.prisma.eventLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      });

      this.logger.debug(`Found ${events.length} events`);
      return events;
    } catch (error) {
      this.logger.error(
        `Failed to query events: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 根据ID获取特定事件
   *
   * @param eventId 事件ID
   * @returns 事件记录或null
   */
  async getEventById(eventId: string): Promise<EventLog | null> {
    this.logger.debug(`Getting event by ID: ${eventId}`);

    try {
      const event = await this.prisma.eventLog.findUnique({
        where: { id: eventId },
      });

      if (event) {
        this.logger.debug(`Found event: ${event.eventType}`);
      } else {
        this.logger.debug(`Event not found: ${eventId}`);
      }

      return event;
    } catch (error) {
      this.logger.error(
        `Failed to get event by ID: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 更新事件处理状态
   *
   * @param eventId 事件ID
   * @param status 新的处理状态
   * @param error 错误信息（可选）
   * @returns 更新后的事件记录
   */
  async updateEventStatus(
    eventId: string,
    status: EventProcessingStatus,
    error?: string,
  ): Promise<EventLog> {
    this.logger.debug(`Updating event ${eventId} status to ${status}`);

    try {
      const updatedEvent = await this.prisma.eventLog.update({
        where: { id: eventId },
        data: {
          processingStatus: status,
          lastProcessingError: error,
          processedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      this.logger.debug(`Event status updated successfully: ${eventId}`);
      return updatedEvent;
    } catch (error) {
      this.logger.error(
        `Failed to update event status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 获取事件统计信息
   *
   * @returns 事件统计数据
   */
  async getEventStats(): Promise<EventStats> {
    this.logger.debug("Getting event statistics");

    try {
      // 获取总事件数
      const totalEvents = await this.prisma.eventLog.count();

      // 按事件类型分组统计
      const eventsByTypeRaw = await this.prisma.eventLog.groupBy({
        by: ["eventType"],
        _count: { id: true },
      });

      // 按处理状态分组统计
      const eventsByStatusRaw = await this.prisma.eventLog.groupBy({
        by: ["processingStatus"],
        _count: { id: true },
      });

      // 转换为更友好的格式
      const eventsByType: Record<string, number> = {};
      eventsByTypeRaw.forEach((item) => {
        eventsByType[item.eventType] = item._count.id;
      });

      const eventsByStatus: Record<EventProcessingStatus, number> = {} as any;
      eventsByStatusRaw.forEach((item) => {
        eventsByStatus[item.processingStatus] = item._count.id;
      });

      const stats = {
        totalEvents,
        eventsByType,
        eventsByStatus,
      };

      this.logger.debug(`Event statistics: ${JSON.stringify(stats)}`);
      return stats;
    } catch (error) {
      this.logger.error(
        `Failed to get event statistics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 清理过期事件
   *
   * @param olderThanDays 清理多少天前的事件
   * @returns 删除的事件数量
   */
  async cleanupOldEvents(olderThanDays: number): Promise<number> {
    if (olderThanDays <= 0) {
      throw new Error("olderThanDays must be a positive number");
    }

    this.logger.log(`Cleaning up events older than ${olderThanDays} days`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prisma.eventLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} old events`);
      return result.count;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup old events: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 获取失败的事件用于重试
   *
   * @param maxAttempts 最大重试次数
   * @param limit 返回的事件数量限制
   * @returns 失败的事件列表
   */
  async retryFailedEvents(
    maxAttempts: number,
    limit: number = 100,
  ): Promise<EventLog[]> {
    this.logger.debug(
      `Getting failed events for retry (max attempts: ${maxAttempts})`,
    );

    try {
      const failedEvents = await this.prisma.eventLog.findMany({
        where: {
          processingStatus: EventProcessingStatus.FAILED,
          processingAttempts: { lt: maxAttempts },
        },
        take: limit,
        orderBy: { createdAt: "asc" }, // 优先处理较早的事件
      });

      this.logger.debug(`Found ${failedEvents.length} failed events for retry`);
      return failedEvents;
    } catch (error) {
      this.logger.error(
        `Failed to get retry events: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 增加事件处理尝试次数
   *
   * @param eventId 事件ID
   * @returns 更新后的事件记录
   */
  async incrementAttempts(eventId: string): Promise<EventLog> {
    this.logger.debug(`Incrementing attempts for event: ${eventId}`);

    try {
      const updatedEvent = await this.prisma.eventLog.update({
        where: { id: eventId },
        data: {
          processingAttempts: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      this.logger.debug(
        `Incremented attempts for event ${eventId} to ${updatedEvent.processingAttempts}`,
      );
      return updatedEvent;
    } catch (error) {
      this.logger.error(
        `Failed to increment attempts: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
