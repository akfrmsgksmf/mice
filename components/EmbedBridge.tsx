'use client';
import { useEffect } from 'react';

export default function EmbedBridge() {
  useEffect(() => {
    // 부모에게 말 보낼 때 사용할 함수
    const send = () => {
      const height = document.documentElement.scrollHeight;
      // 부모 창에 현재 문서 높이 전달
      window.parent?.postMessage({ type: 'mice:resize', height, href: window.location.href }, '*');
    };

    // 초기 2~3회 보냄(레이아웃 안정화)
    const timers = [0, 150, 400].map((t) => setTimeout(send, t));

    // 내용 변경 감지(리사이즈, 폰트 로드 등)
    const ro = new ResizeObserver(() => send());
    ro.observe(document.body);

    // 라우트 변경시(스크롤/선택 등)도 주기적으로 업데이트
    const onHash = () => send();
    window.addEventListener('hashchange', onHash);

    return () => {
      timers.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  return null;
}
