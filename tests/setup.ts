/**
 * Jest测试设置文件
 */

// 模拟performance.now
global.performance = {
    now: () => Date.now(),
} as any;

// 模拟requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(callback, 16) as any;
};

global.cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
};

// 模拟console方法以减少测试输出
const originalConsoleLog = console.log;
console.log = (...args: any[]) => {
    // 只输出测试结果相关的日志
    if (args[0]?.includes?.('PASS') || args[0]?.includes?.('FAIL')) {
        originalConsoleLog.apply(console, args);
    }
};

// 测试完成后恢复
afterAll(() => {
    console.log = originalConsoleLog;
});
