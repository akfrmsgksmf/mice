(function () {
  // 현재 페이지 내의 <script data-mice-embed ...> 태그를 찾음
  var scripts = document.querySelectorAll('script[data-mice-embed]');
  if (!scripts.length) return;

  function createIframe(scriptEl) {
    var src = scriptEl.getAttribute('data-src'); // 예: https://booking.mydomain.com/booking?embed=1
    if (!src) return;

    // 컨테이너
    var container = document.createElement('div');
    container.style.width = '100%';
    container.style.position = 'relative';
    container.style.minHeight = '400px';

    // iframe
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.minHeight = '800px'; // 초기 높이
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('title', '예약');

    container.appendChild(iframe);
    scriptEl.parentNode.insertBefore(container, scriptEl.nextSibling);

    // 자식에서 보내는 높이 적용
    function onMsg(e) {
      var data = e.data || {};
      if (data.type === 'mice:resize') {
        // 같은 src의 메시지만 수용(간단 검증)
        try {
          var u = new URL(iframe.src);
          var href = new URL(data.href);
          if (u.origin !== href.origin) return;
        } catch (_) {}
        var h = Number(data.height) || 0;
        if (h > 0 && h < 1e6) {
          iframe.style.height = h + 'px';
        }
      }
    }
    window.addEventListener('message', onMsg);
  }

  scripts.forEach(createIframe);
})();
