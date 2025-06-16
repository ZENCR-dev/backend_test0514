import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';

/**
 * Step 0 前置验证：EventEmitter2功能验证测试
 * 
 * 目标：验证@nestjs/event-emitter配置和基础事件发布/订阅功能是否正常工作
 * 这是Task 5B Phase B2开发前的关键前置验证
 */
describe('EventEmitter2 Configuration Verification', () => {
  let eventEmitter: EventEmitter2;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
    }).compile();

    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('基础事件发布/订阅功能', () => {
    it('应该能够发布和监听简单事件', (done) => {
      const testData = { message: 'test event data' };
      
      // 设置事件监听器
      eventEmitter.once('test.event', (data) => {
        expect(data).toEqual(testData);
        done();
      });

      // 发布事件
      eventEmitter.emit('test.event', testData);
    });

    it('应该支持多个监听器', () => {
      let listener1Called = false;
      let listener2Called = false;
      const testData = { value: 123 };

      // 设置多个监听器
      eventEmitter.once('multi.listener.test', () => {
        listener1Called = true;
      });

      eventEmitter.once('multi.listener.test', (data) => {
        listener2Called = true;
        expect(data).toEqual(testData);
      });

      // 发布事件
      eventEmitter.emit('multi.listener.test', testData);

      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
    });

    it('应该支持异步事件处理', async () => {
      const results: string[] = [];
      
      // 异步事件处理器
      eventEmitter.on('async.test', async (data) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(`processed: ${data.id}`);
      });

      // 发布多个事件
      eventEmitter.emit('async.test', { id: 'event1' });
      eventEmitter.emit('async.test', { id: 'event2' });

      // 等待异步处理完成
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(results).toContain('processed: event1');
      expect(results).toContain('processed: event2');
    });
  });

  describe('支付相关事件模拟', () => {
    it('应该能够处理支付成功事件', (done) => {
      const paymentData = {
        orderId: 'order-123',
        paymentIntentId: 'pi_test_123',
        amount: 5000,
        currency: 'nzd'
      };

      eventEmitter.once('payment.succeeded', (data) => {
        expect(data.orderId).toBe('order-123');
        expect(data.paymentIntentId).toBe('pi_test_123');
        expect(data.amount).toBe(5000);
        done();
      });

      eventEmitter.emit('payment.succeeded', paymentData);
    });

    it('应该能够处理支付失败事件', (done) => {
      const failureData = {
        orderId: 'order-456',
        paymentIntentId: 'pi_test_456',
        reason: 'insufficient_funds'
      };

      eventEmitter.once('payment.failed', (data) => {
        expect(data.orderId).toBe('order-456');
        expect(data.reason).toBe('insufficient_funds');
        done();
      });

      eventEmitter.emit('payment.failed', failureData);
    });

    it('应该能够处理账户扣款事件', (done) => {
      const deductionData = {
        clinicId: 'clinic-789',
        amount: 2500,
        orderId: 'order-789',
        transactionId: 'txn_123'
      };

      eventEmitter.once('clinic.account.deducted', (data) => {
        expect(data.clinicId).toBe('clinic-789');
        expect(data.amount).toBe(2500);
        expect(data.orderId).toBe('order-789');
        done();
      });

      eventEmitter.emit('clinic.account.deducted', deductionData);
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该能够处理不存在的事件监听器', () => {
      // 发布没有监听器的事件不应该抛出错误
      expect(() => {
        eventEmitter.emit('non.existent.event', { data: 'test' });
      }).not.toThrow();
    });

    it('应该能够移除事件监听器', () => {
      let callCount = 0;
      
      const listener = () => {
        callCount++;
      };

      eventEmitter.on('removable.event', listener);
      
      // 发布事件，应该被处理
      eventEmitter.emit('removable.event');
      expect(callCount).toBe(1);

      // 移除监听器
      eventEmitter.off('removable.event', listener);
      
      // 再次发布事件，不应该被处理
      eventEmitter.emit('removable.event');
      expect(callCount).toBe(1);
    });

    it('应该能够处理监听器中的错误', () => {
      const errorListener = () => {
        throw new Error('Test error in listener');
      };

      eventEmitter.on('error.test', errorListener);

      // EventEmitter2会抛出监听器中的错误，这是正常行为
      expect(() => {
        eventEmitter.emit('error.test');
      }).toThrow('Test error in listener');
    });
  });

  describe('性能和并发测试', () => {
    it('应该能够处理大量并发事件', async () => {
      const eventCount = 100;
      const receivedEvents: number[] = [];

      eventEmitter.on('performance.test', (data) => {
        receivedEvents.push(data.index);
      });

      // 发布大量事件
      for (let i = 0; i < eventCount; i++) {
        eventEmitter.emit('performance.test', { index: i });
      }

      // 等待所有事件处理完成
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedEvents).toHaveLength(eventCount);
      expect(receivedEvents).toContain(0);
      expect(receivedEvents).toContain(eventCount - 1);
    });
  });
}); 