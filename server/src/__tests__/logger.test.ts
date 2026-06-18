/**
 * 测试 logger 模块的基本功能
 */
import logger from '../logger';

describe('logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('info 输出到 console.log', () => {
    logger.info('test info message');
    expect(consoleLogSpy).toHaveBeenCalled();
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain('INFO');
    expect(call).toContain('test info message');
  });

  it('warn 输出到 console.warn', () => {
    logger.warn('test warn message');
    expect(consoleWarnSpy).toHaveBeenCalled();
    const call = consoleWarnSpy.mock.calls[0][0];
    expect(call).toContain('WARN');
    expect(call).toContain('test warn message');
  });

  it('error 输出到 console.error', () => {
    logger.error('test error message');
    expect(consoleErrorSpy).toHaveBeenCalled();
    const call = consoleErrorSpy.mock.calls[0][0];
    expect(call).toContain('ERROR');
    expect(call).toContain('test error message');
  });

  it('debug 在默认 info 级别下不输出', () => {
    logger.debug('debug message');
    // 默认 LOG_LEVEL 为 info，debug 不输出
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('支持 extra 参数', () => {
    logger.info('with extra', { key: 'value' });
    expect(consoleLogSpy).toHaveBeenCalled();
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain('with extra');
  });

  it('多次调用不崩溃', () => {
    logger.info('msg1');
    logger.info('msg2');
    logger.warn('msg3');
    logger.error('msg4');
    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
