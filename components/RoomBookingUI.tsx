'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type Room = {
  id: number;
  name: string;
  hourlyPrice: number;
  photos: string[];
  capacity?: number;
  description?: string;
};
export type Config = {
  openHour: number;
  closeHour: number;
  rooms: Room[];
  customerNotice?: string;
};
export type Slot = { time: string; isoStart: string; isoEnd: string; status: 'free' | 'booked' };
export type Avail = {
  date: string;
  roomId: number;
  openHour: number;
  closeHour: number;
  slots: Slot[];
  closed?: boolean;
};

const fmtKRTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '-';

const fmtKRRange = (startIso?: string, endIso?: string) => {
  if (!startIso || !endIso) return '-';
  const start = new Date(startIso);
  const end = new Date(endIso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(start.getHours())}:${pad(start.getMinutes())}~${pad(end.getHours())}:${pad(
    end.getMinutes(),
  )}`;
};

const fmtKRDateLabel = (isoDate: string) => {
  const d = new Date(isoDate);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = d.toLocaleDateString('ko-KR', { weekday: 'short' });
  return `${m}월${day}일 ${wd}`;
};

const todayStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const getWeekStart = (iso: string) => {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7; // 월요일 시작
  d.setDate(d.getDate() - day);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
  const t = await r.text();
  try {
    return JSON.parse(t) as T;
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function inferCapacity(name: string): number | undefined {
  const m = name.match(/(\d+)\s*인/);
  return m ? parseInt(m[1], 10) : undefined;
}

// capacity → 카테고리명
function capacityToCategory(cap?: number): string {
  if (cap === 2) return '2인 부스';
  if (cap === 4) return '4인 부스';
  if (cap === 5) return '5인 부스';
  return '해당없음';
}

export default function RoomBookingUI() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<Config | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [cfgLoading, setCfgLoading] = useState(true);

  const [weekStart, setWeekStart] = useState<string>(getWeekStart(todayStr()));
  const weekDates = useMemo(() => range(7).map((i) => addDays(weekStart, i)), [weekStart]);

  const [weekAvail, setWeekAvail] = useState<Record<string, Avail> | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);

  const [selDate, setSelDate] = useState<string | null>(null);
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const weekRef = useRef<HTMLDivElement | null>(null);
  const servicesRef = useRef<HTMLDivElement | null>(null);

  // 카테고리 토글 상태
  const [catOpen, setCatOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setCfgLoading(true);
      const cfg = await getJSON<Config>('/api/config');
      cfg.rooms = cfg.rooms.map((r) => ({
        ...r,
        capacity: r.capacity ?? inferCapacity(r.name),
      }));
      setConfig(cfg);
      setRoomId((prev) => prev ?? cfg.rooms[0]?.id ?? null);

      // 초기 카테고리 열기 상태: 모두 열림
      const initialCats: Record<string, boolean> = {};
      const cats = new Set(cfg.rooms.map((r) => capacityToCategory(r.capacity)));
      cats.forEach((c) => (initialCats[c] = true));
      setCatOpen(initialCats);

      setCfgLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!roomId) return;
      setWeekLoading(true);
      const entries = await Promise.all(
        weekDates.map(async (d) => {
          const av = await getJSON<Avail>(`/api/availability?roomId=${roomId}&date=${d}`);
          return [d, av] as const;
        }),
      );
      const map: Record<string, Avail> = {};
      entries.forEach(([d, av]) => {
        map[d] = av;
      });
      setWeekAvail(map);
      setSelDate(null);
      setSelStart(null);
      setSelEnd(null);
      setWeekLoading(false);
    })();
  }, [roomId, weekStart]);

  const timeIndex = useMemo(() => {
    const first = weekAvail?.[weekDates[0]];
    return first ? first.slots.map((s, i) => ({ i, start: s.isoStart, end: s.isoEnd })) : [];
  }, [weekAvail, weekDates]);

  const selected = useMemo(() => {
    if (!selDate || selStart == null || selEnd == null || !weekAvail) return null;
    const av = weekAvail[selDate];
    if (!av) return null;
    const slots = av.slots.slice(selStart, selEnd);
    return {
      minutes: slots.length * 30,
      startIso: slots[0]?.isoStart,
      endIso: slots[slots.length - 1]?.isoEnd,
      hasBooked: slots.some((s) => s.status === 'booked'),
    };
  }, [selDate, selStart, selEnd, weekAvail]);

  const price = useMemo(() => {
    if (!config || !roomId || !selected) return 0;
    const r = config.rooms.find((rr) => rr.id === roomId);
    if (!r) return 0;
    return Math.round((selected.minutes / 60) * r.hourlyPrice);
  }, [config, roomId, selected]);

  function clickCell(day: string, idx: number, status: 'free' | 'booked') {
    if (status === 'booked') return;
    if (selDate === null) {
      setSelDate(day);
      setSelStart(idx);
      setSelEnd(idx + 1);
      return;
    }
    if (selDate !== day) {
      setSelDate(day);
      setSelStart(idx);
      setSelEnd(idx + 1);
      return;
    }
    const s = Math.min(selStart ?? idx, idx);
    const e = Math.max(selStart ?? idx, idx) + 1;
    setSelStart(s);
    setSelEnd(e);
  }
  function clearSel() {
    setSelDate(null);
    setSelStart(null);
    setSelEnd(null);
  }

  async function submit() {
    if (!config || !weekAvail || !roomId) return;
    if (!name.trim() || !phone.trim()) {
      alert('성함과 연락처를 입력해 주세요.');
      return;
    }
    if (!selected || selected.hasBooked) {
      alert('선택 구간을 다시 확인해 주세요.');
      return;
    }
    const body = {
      roomId,
      date: selDate!,
      startIso: selected.startIso!,
      endIso: selected.endIso!,
      name,
      phone,
      notes,
    };
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      alert(t || '예약 실패');
      return;
    }
    alert('예약 완료!');
    clearSel();
    const av = await getJSON<Avail>(`/api/availability?roomId=${roomId}&date=${selDate!}`);
    setWeekAvail((prev) => ({ ...prev!, [selDate!]: av }));
    setStep(0);
    servicesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const currentRoom = useMemo(() => config?.rooms.find((r) => r.id === roomId), [config, roomId]);
  const sidebarPrimaryBtnDisabled =
    !selected || selected.hasBooked || !name.trim() || !phone.trim();

  // 방을 카테고리로 그룹핑 + 이름 가나다 정렬
  const grouped = useMemo(() => {
    const map = new Map<string, Room[]>();
    (config?.rooms ?? []).forEach((r) => {
      const key = capacityToCategory(r.capacity);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    // 카테고리별 이름 정렬 (한글 가나다)
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
      map.set(k, arr);
    }
    // 표출 순서: 2인 → 4인 → 5인 → 해당없음
    const order = ['2인 부스', '4인 부스', '5인 부스', '해당없음'];
    const out: Array<{ cat: string; rooms: Room[] }> = [];
    order.forEach((cat) => {
      if (map.has(cat)) out.push({ cat, rooms: map.get(cat)! });
    });
    // 기타 카테고리(혹시 향후 추가된다면) 뒤에 붙이기
    for (const [cat, rooms] of map.entries()) {
      if (!order.includes(cat)) out.push({ cat, rooms });
    }
    return out;
  }, [config]);

  return (
    <>
      <div className="stepbar">
        <div className="steps">
          <div className={`step ${step === 0 ? 'active' : ''}`}>
            <span className="dot" /> 서비스
          </div>
          <div className={`step ${step === 1 ? 'active' : ''}`}>
            <span className="dot" /> 시간
          </div>
          <div className={`step ${step === 2 ? 'active' : ''}`}>
            <span className="dot" /> 고객
          </div>
        </div>
      </div>

      <div className="container">
        <div className="layout">
          <div>
            <div className="card" ref={servicesRef} style={{ minHeight: 360 }}>
              <div className="controls" style={{ justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800 }}>서비스 선택</div>
                {/* 오른쪽 현재시간 배지 제거됨 */}
              </div>

              {step === 0 && (
                <>
                  {cfgLoading && <div>설정을 불러오는 중...</div>}
                  {!cfgLoading && (
                    <>
                      {/* 수용 인원 필터 UI 제거 → 카테고리 그룹 렌더 */}
                      <div className="categories">
                        {grouped.map(({ cat, rooms }) => {
                          const open = catOpen[cat] ?? true;
                          return (
                            <div key={cat} className="category">
                              <button
                                className="cat-head"
                                onClick={() => setCatOpen((prev) => ({ ...prev, [cat]: !open }))}
                                aria-expanded={open}
                              >
                                <span className={`chev ${open ? 'open' : ''}`}>▸</span>
                                <span className="cat-title">{cat}</span>
                              </button>

                              {open && (
                                <div className="services">
                                  {rooms.map((r) => (
                                    <div key={r.id} className="service-card">
                                      {/* 사진 1장, A4 가로 비율 */}
                                      <div className="a4box">
                                        {r.photos && r.photos.length > 0 ? (
                                          <img
                                            src={r.photos[0]}
                                            alt="room photo"
                                            className="a4img"
                                          />
                                        ) : (
                                          <div className="a4ph">이미지 준비중</div>
                                        )}
                                      </div>

                                      {/* 내용: 왼쪽 정보, 오른쪽 큰 선택 버튼 */}
                                      <div className="service-bottom">
                                        <div className="service-meta">
                                          <div className="service-title">{r.name}</div>
                                          {r.description && (
                                            <div className="desc">{r.description}</div>
                                          )}
                                          <div className="note">
                                            운영 {String(config!.openHour).padStart(2, '0')}:00 ~{' '}
                                            {String(config!.closeHour).padStart(2, '0')}:00
                                          </div>
                                          <div className="price">
                                            ₩{r.hourlyPrice.toLocaleString()} / 시간
                                          </div>
                                          {/* 필요시 표시: {r.capacity && <div className="badge soft">{r.capacity}인 기준</div>} */}
                                        </div>
                                        <div className="service-action">
                                          <button
                                            className="btn xl"
                                            onClick={() => {
                                              setRoomId(r.id);
                                              setStep(1);
                                              setTimeout(
                                                () =>
                                                  weekRef.current?.scrollIntoView({
                                                    behavior: 'smooth',
                                                    block: 'start',
                                                  }),
                                                50,
                                              );
                                            }}
                                          >
                                            선택
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {rooms.length === 0 && (
                                    <div className="note" style={{ padding: 12 }}>
                                      해당 카테고리에 서비스가 없습니다.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}

              {step >= 1 && (
                <div className="selected-head">
                  <div>
                    <div className="mini">선택 서비스</div>
                    <div className="sel-name">{currentRoom?.name ?? '-'}</div>
                  </div>
                  <div className="sel-actions">
                    <button
                      className="btn ghost"
                      onClick={() => {
                        setStep(0);
                        servicesRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      변경
                    </button>
                  </div>
                </div>
              )}

              {/* 선택 후 이미지: 두 개, A4 비율 */}
              {step >= 1 && (
                <div className="selected-photos" style={{ marginTop: 12 }}>
                  {[0, 1].map((idx) => {
                    const src = currentRoom?.photos?.[idx];
                    return src ? (
                      <div className="a4box" key={idx}>
                        <img src={src} alt={`room photo ${idx + 1}`} className="a4img" />
                      </div>
                    ) : (
                      <div className="a4box" key={idx}>
                        <div className="a4ph">이미지 준비중</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {step === 1 && (
              <div className="card" style={{ marginTop: 16 }} ref={weekRef}>
                <div className="week-toolbar">
                  <button className="week-btn" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                    〈 지난 주
                  </button>
                  <div className="week-range" />
                  <button className="week-btn" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                    다음 주 〉
                  </button>
                </div>
                {weekLoading && <div>가용 시간을 불러오는 중...</div>}
                {weekAvail && !weekLoading && (
                  <div className="week">
                    <table className="week-table">
                      <thead>
                        <tr>
                          {/* 왼쪽 시간 열 제거 */}
                          {weekDates.map((d) => (
                            <th key={d}>{fmtKRDateLabel(d)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {timeIndex.map(({ i, start, end }) => (
                          <tr key={i} style={{ height: 52 }}>
                            {/* 시간 열 없음 */}
                            {weekDates.map((d) => {
                              const av = weekAvail[d];
                              const cell = av?.slots[i];
                              const selectedCell =
                                selDate === d &&
                                selStart != null &&
                                selEnd != null &&
                                i >= selStart &&
                                i < selEnd;
                              const cls = `cell ${cell?.status === 'booked' ? 'full' : ''} ${
                                selectedCell ? 'selected' : ''
                              }`;
                              return (
                                <td
                                  key={d}
                                  onClick={() => cell && clickCell(d, i, cell.status)}
                                  className={cls}
                                >
                                  {cell ? fmtKRRange(cell.isoStart, cell.isoEnd) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      setStep(0);
                      servicesRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    〈 뒤로 가기
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setStep(2);
                      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                    }}
                    disabled={!selected || selected.hasBooked}
                  >
                    다음 단계
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="card" style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>세부사항 확인</div>
                <div
                  className="card"
                  style={{ padding: '12px', borderStyle: 'dashed', lineHeight: 1.9 }}
                >
                  <div>
                    선택 서비스: <b>{currentRoom?.name ?? '-'}</b>
                  </div>
                  <div>
                    선택 날짜: <b>{selDate ? fmtKRDateLabel(selDate) : '-'}</b>
                  </div>
                  <div>
                    시작 시간: <b>{fmtKRTime(selected?.startIso)}</b>
                  </div>
                  <div>
                    종료 시간: <b>{fmtKRTime(selected?.endIso)}</b>
                  </div>
                  <div>
                    총 이용시간: <b>{selected?.minutes ?? 0}분</b>
                  </div>
                  <div>
                    예상 총액: <b>₩{price.toLocaleString('ko-KR')}</b>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 16 }}>
                  <button className="btn ghost" onClick={() => setStep(1)}>
                    〈 시간 다시 선택
                  </button>
                  <button
                    className="btn"
                    onClick={submit}
                    disabled={!selected || selected.hasBooked || !name || !phone}
                  >
                    지금 예약
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 우측 고정 입력(항상 표시) */}
          <div className="card sticky-card">
            <div className="side-title">고객 정보</div>
            <input
              className="input lg"
              placeholder="이름 (필수)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div style={{ height: 10 }} />
            <input
              className="input lg"
              placeholder="연락처 (필수)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <div style={{ height: 10 }} />
            <textarea
              className="input lg"
              placeholder="메모 (선택)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
            <div className="note" style={{ marginTop: 12 }}>
              · 입력 정보는 예약 단계 전반에서 유지됩니다.
            </div>

            <div
              style={{
                marginTop: 16,
                borderTop: '1px solid var(--border)',
                paddingTop: 12,
                lineHeight: 1.9,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>요약</div>
              <div>
                서비스: <b>{currentRoom?.name ?? '-'}</b>
              </div>
              <div>
                시작 시간: <b>{selected?.startIso ? fmtKRTime(selected.startIso) : '-'}</b>
              </div>
              <div>
                종료 시간: <b>{selected?.endIso ? fmtKRTime(selected.endIso) : '-'}</b>
              </div>
              <div>
                총 이용시간: <b>{selected?.minutes ?? 0}분</b>
              </div>
              <div>
                예상금액: <b>₩{price.toLocaleString('ko-KR')}</b>
              </div>
              <div className="row" style={{ marginTop: 12, gap: 8 }}>
                <button className="btn ghost" onClick={clearSel}>
                  선택 해제
                </button>
                <button
                  className="btn"
                  onClick={() => setStep(2)}
                  disabled={!selected || selected.hasBooked}
                >
                  예약 단계로
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        :root {
          --border: #e5e7eb;
          --muted: #6b7280;
          --primary: #2e90ff;
          --bg: #ffffff;
          --chip: #f3f4f6;
        }
        .container {
          max-width: 1120px;
          margin: 0 auto;
          padding: 8px 12px 40px;
        }
        .layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 16px;
          align-items: start;
        }
        .card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        .sticky-card {
          position: sticky;
          top: 12px;
        }
        .stepbar {
          position: sticky;
          top: 0;
          z-index: 5;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(6px);
          border-bottom: 1px solid var(--border);
          margin-bottom: 8px;
        }
        .steps {
          display: flex;
          gap: 16px;
          padding: 10px 12px;
        }
        .step {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--muted);
          font-weight: 600;
        }
        .step.active {
          color: #111827;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--muted);
          display: inline-block;
        }
        .step.active .dot {
          background: var(--primary);
        }
        .controls {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }

        .categories {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .category {
          border: 1px solid var(--border);
          border-radius: 14px;
        }
        .cat-head {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #fafafa;
          border: none;
          border-bottom: 1px solid var(--border);
          border-radius: 14px 14px 0 0;
          cursor: pointer;
          font-weight: 900;
        }
        .chev {
          display: inline-block;
          transition: transform 0.15s ease;
        }
        .chev.open {
          transform: rotate(90deg);
        }
        .cat-title {
          font-weight: 900;
        }

        .services {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
          padding: 12px;
        }
        .service-card {
          border: 1px solid var(--border);
          padding: 12px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .service-title {
          font-weight: 800;
        }
        .desc {
          font-size: 12px;
          color: #4b5563;
        }
        .price {
          font-weight: 800;
          font-size: 14px;
        }
        .btn {
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 10px 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn.ghost {
          background: transparent;
          color: #111827;
          border: 1px solid var(--border);
        }
        .row {
          display: flex;
          align-items: center;
        }

        .service-bottom {
          display: flex;
          align-items: stretch;
          justify-content: space-between;
          gap: 12px;
        }
        .service-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .service-action {
          display: flex;
          align-items: flex-end;
        }
        .btn.xl {
          padding: 14px 18px;
          font-size: 16px;
          border-radius: 12px;
        }

        .a4box {
          width: 100%;
          aspect-ratio: 297 / 210;
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .a4img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .a4ph {
          color: #6b7280;
          font-size: 13px;
        }

        .selected-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px;
          border: 1px dashed var(--border);
          border-radius: 12px;
        }
        .sel-name {
          font-weight: 900;
        }
        .mini {
          font-size: 12px;
          color: var(--muted);
        }

        .selected-photos {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .week-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .week {
          overflow: auto;
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        .week-table {
          border-collapse: separate;
          border-spacing: 0;
          width: max-content;
          min-width: 100%;
        }
        .week-table th,
        .week-table td {
          border-bottom: 1px solid var(--border);
        }
        .week-table th {
          position: sticky;
          top: 0;
          background: #fff;
          z-index: 1;
          padding: 10px;
          font-weight: 800;
          text-align: center;
          white-space: nowrap;
        }
        .week-table td {
          padding: 10px;
          text-align: center;
          font-size: 13px;
          min-width: 120px;
        }
        .cell {
          cursor: pointer;
          transition: border-color 0.08s ease;
          border: 2px solid transparent;
          background: transparent;
          color: inherit;
        }
        .cell:hover {
          border-color: #9ca3af;
        }
        .cell.full {
          background: #fff5f5;
          color: #991b1b;
          cursor: not-allowed;
          border-color: #fecaca;
        }
        .cell.selected {
          border-color: #111827;
          background: transparent;
          color: inherit;
        }

        .side-title {
          font-weight: 900;
          font-size: 18px;
          margin-bottom: 10px;
        }
        .input {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 14px;
        }
        .input.lg {
          padding: 12px 12px;
          font-size: 16px;
        }
        .note {
          color: #6b7280;
          font-size: 12px;
        }

        @media (max-width: 980px) {
          .layout {
            grid-template-columns: 1fr;
          }
          .sticky-card {
            position: static;
          }
          .services {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
