import EmbedBridge from '@/components/EmbedBridge';
import RoomBookingUI from '@/components/RoomBookingUI';

export default function Page({ searchParams }: { searchParams: { [k: string]: string } }) {
  const isEmbed = searchParams?.embed === '1';
  return (
    <>
      {isEmbed && <EmbedBridge />}
      <main className={isEmbed ? 'embed' : ''}>
        <RoomBookingUI />
      </main>

      <style jsx global>{`
        /* 임베드 모드일 때 바깥 여백/배경을 조금 더 타이트하게 */
        .embed {
          background: transparent;
        }
        .embed .stepbar {
          position: static;
        } /* 호스트 페이지의 스크롤과 충돌 줄이기 */
      `}</style>
    </>
  );
}
