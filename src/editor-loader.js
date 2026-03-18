// 页面加载完成后隐藏加载动画
window.addEventListener('load', () => {
  setTimeout(() => {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.classList.add('hidden');
    }
  }, 500);
});

// 确保DOM加载完成后也执行一次
document.addEventListener('DOMContentLoaded', () => {
  // 如果页面已经加载完成，立即隐藏加载动画
  if (document.readyState === 'complete') {
    setTimeout(() => {
      const loadingElement = document.getElementById('loading');
      if (loadingElement) {
        loadingElement.classList.add('hidden');
      }
    }, 300);
  }
}); 