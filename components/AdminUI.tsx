'use client';

import type { Avail, Booking, Config, Room } from '@/lib/types';
import React, { useEffect, useMemo, useRef, useState } from 'react';

type View = 'list' | 'preview' | 'roomSettings' | 'settingsIndex';

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function patchJSON<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const today = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const addDays = (iso: string, n: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const getWeekStart = (iso: string) => {
  const d = new Date(iso);
  const w = (d.getDay() + 6) % 7; // 월요일 시작
  d.setDate(d.getDate() - w);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const fmtKRTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtKRDateLabel = (isoDate: string) => {
  const d = new Date(isoDate);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = d.toLocaleDateString('ko-KR', { weekday: 'short' });
  return `${m}월${day}일 ${wd}`;
};
const fmtRange = (s?: string, e?: string) => {
  if (!s || !e) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  const a = new Date(s),
    b = new Date(e);
  return `${pad(a.getHours())}:${pad(a.getMinutes())}~${pad(b.getHours())}:${pad(b.getMinutes())}`;
};

export default function AdminUI() {
  const [date, setDate] = useState<string>(today());
  const [config, setConfig] = useState<Config | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blackoutRooms, setBlackoutRooms] = useState<Record<string, boolean>>({});

  const [view, setView] = useState<View>('list');
  const [roomId, setRoomId] = useState<number | null>(null);

  // 주간 보기 상태
  const [weekStart, setWeekStart] = useState<string>(getWeekStart(today()));
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const [weekAvail, setWeekAvail] = useState<Record<string, Avail>>({});
  const [weekBlackouts, setWeekBlackouts] = useState<Record<string, boolean>>({});
  const [weekLoading, setWeekLoading] = useState(false);

  // 단일 룸 설정 폼
  const [form, setForm] = useState<{
    name: string;
    hourlyPrice: number;
    capacity?: number;
    photos: string[]; // 업로드 결과 URL 배열
  }>({
    name: '',
    hourlyPrice: 0,
    capacity: undefined,
    photos: [],
  });

  // 서비스 일람/편집(테이블)
  const [editRooms, setEditRooms] = useState<Room[]>([]);
  const dragFrom = useRef<number | null>(null);

  // 초기 설정 로드
  useEffect(() => {
    (async () => {
      const cfg = await getJSON<Config>('/api/config');
      setConfig(cfg);
    })();
  }, []);

  // 일간 예약/블랙아웃 로드(리스트용)
  useEffect(() => {
    (async () => {
      const list = await getJSON<Booking[]>(`/api/bookings?date=${date}`);
      setBookings(list);
      const bo = await getJSON<{ date: string; rooms: Record<string, boolean> }>(
        `/api/blackouts?date=${date}`,
      );
      setBlackoutRooms(bo.rooms || {});
    })();
  }, [date]);

  const roomsById = useMemo(() => {
    const m: Record<number, Room> = {};
    (config?.rooms || []).forEach((r) => (m[r.id] = r));
    return m;
  }, [config]);
  const bookingsByRoom = useMemo(() => {
    const m: Record<number, Booking[]> = {};
    bookings.forEach((b) => {
      (m[b.roomId] ||= []).push(b);
    });
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.startIso.localeCompare(b.startIso)));
    return m;
  }, [bookings]);

  const currentRoom = roomId != null ? roomsById[roomId] : null;

  // 미리보기 열기
  function openPreview(rid: number) {
    setRoomId(rid);
    setView('preview');
    setWeekStart(getWeekStart(today()));
  }

  // 주간 데이터 로드
  useEffect(() => {
    (async () => {
      if (view !== 'preview' || roomId == null) return;
      setWeekLoading(true);
      const entries = await Promise.all(
        weekDates.map(async (d) => {
          const [av, bo] = await Promise.all([
            getJSON<Avail>(`/api/availability?roomId=${roomId}&date=${d}`),
            getJSON<{ date: string; rooms: Record<string, boolean> }>(`/api/blackouts?date=${d}`),
          ]);
          return [d, av, !!bo.rooms?.[String(roomId)]] as const;
        }),
      );
      const avMap: Record<string, Avail> = {};
      const boMap: Record<string, boolean> = {};
      entries.forEach(([d, av, closed]) => {
        avMap[d] = av;
        boMap[d] = closed;
      });
      setWeekAvail(avMap);
      setWeekBlackouts(boMap);
      setWeekLoading(false);
    })();
  }, [view, roomId, weekDates]);

  // 날짜별 블랙아웃 저장(주간 헤더 토글)
  async function saveBlackoutFor(day: string, rid: number, closed: boolean) {
    await patchJSON('/api/blackouts', { date: day, roomId: rid, closed });
    setWeekBlackouts((prev) => ({ ...prev, [day]: closed }));
    const av = await getJSON<Avail>(`/api/availability?roomId=${rid}&date=${day}`);
    setWeekAvail((prev) => ({ ...prev, [day]: av }));
  }

  // 일간 블랙아웃 저장(리스트 카드)
  async function saveBlackoutDaily(rid: number, closed: boolean) {
    await patchJSON('/api/blackouts', { date, roomId: rid, closed });
    setBlackoutRooms((prev) => ({ ...prev, [String(rid)]: closed }));
  }

  // 단일 룸 설정 화면으로
  function openRoomSettings() {
    if (!currentRoom) return;
    setForm({
      name: currentRoom.name,
      hourlyPrice: currentRoom.hourlyPrice,
      capacity: currentRoom.capacity,
      photos: currentRoom.photos || [],
    });
    setView('roomSettings');
  }

  // ▶ 사진 업로드
  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const fd = new FormData();
    Array.from(fileList).forEach((f) => fd.append('files', f));
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!r.ok) {
      alert(await r.text());
      return;
    }
    const data: { urls: string[] } = await r.json();
    setForm((v) => ({ ...v, photos: [...(v.photos || []), ...data.urls] }));
  }
  function removePhoto(idx: number) {
    setForm((v) => ({ ...v, photos: (v.photos || []).filter((_, i) => i !== idx) }));
  }

  // 단일 룸 설정 저장
  async function saveRoomSettings() {
    if (!config || !currentRoom) return;

    const nextRooms: Room[] = config.rooms.map((r) =>
      r.id === currentRoom.id
        ? {
            ...r,
            name: form.name,
            hourlyPrice: Number(form.hourlyPrice),
            capacity: form.capacity ? Number(form.capacity) : undefined,
            photos: form.photos || [],
          }
        : r,
    );
    const nextCfg = await patchJSON<Config>('/api/config', { rooms: nextRooms });
    setConfig(nextCfg);
    alert('저장 완료: 서비스 설정이 반영되었습니다.');
    setView('preview');
  }

  // 서비스 일람/편집(테이블)
  function openSettingsIndex() {
    if (!config) return;
    setEditRooms(config.rooms.map((r) => ({ ...r })));
    setView('settingsIndex');
  }
  function updateEditRoom(idx: number, patch: Partial<Room>) {
    setEditRooms((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addService() {
    setEditRooms((prev) => {
      const maxId = prev.reduce((m, r) => Math.max(m, r.id), 0);
      return [
        ...prev,
        {
          id: maxId + 1,
          name: `신규 서비스 ${maxId + 1}`,
          hourlyPrice: 0,
          photos: [],
          capacity: undefined,
          description: '',
        },
      ];
    });
  }
  function deleteService(idx: number) {
    const r = editRooms[idx];
    if (confirm(`"${r.name}" 서비스를 삭제할까요?`)) {
      setEditRooms((prev) => prev.filter((_, i) => i !== idx));
    }
  }
  function onDragStart(idx: number) {
    dragFrom.current = idx;
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(idx: number) {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from == null || from === idx) return;
    setEditRooms((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
  }
  async function saveSettingsIndex() {
    for (const r of editRooms) {
      if (!r.name.trim()) {
        alert('서비스 이름을 입력하세요.');
        return;
      }
      if (typeof r.hourlyPrice !== 'number' || Number.isNaN(r.hourlyPrice)) {
        alert('시간당 비용이 올바르지 않습니다.');
        return;
      }
      if (!Array.isArray(r.photos)) r.photos = [];
    }
    const nextCfg = await patchJSON<Config>('/api/config', { rooms: editRooms });
    setConfig(nextCfg);
    alert('저장되었습니다.');
    setView('list');
  }

  return (
    <div className="admin-wrap">
      {/* 상단 바 */}
      <div className="admin-top">
        <div className="left">
          <div className="title">관리자 페이지</div>
        </div>
        <div className="right">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="date"
          />
          <button className="btn ghost" onClick={openSettingsIndex} style={{ marginLeft: 8 }}>
            설정
          </button>
        </div>
      </div>

      {/* 리스트 뷰 (일간) */}
      {view === 'list' && (
        <div className="services">
          {(config?.rooms || []).map((r) => {
            const list = bookingsByRoom[r.id] || [];
            const closed = !!blackoutRooms[String(r.id)];
            return (
              <div key={r.id} className="svc-card">
                <div className="svc-head">
                  <button
                    className="svc-name"
                    onClick={() => openPreview(r.id)}
                    title="서비스 미리보기/설정"
                  >
                    {r.name}
                  </button>
                  <div className="blk">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={closed}
                        onChange={(e) => saveBlackoutDaily(r.id, e.currentTarget.checked)}
                      />
                      <span className="slider" />
                    </label>
                    <span className="blk-label">{closed ? '예약불가' : '예약가능'}</span>
                  </div>
                </div>

                <div className="book-list">
                  {list.length === 0 && <div className="nores">예약 없음</div>}
                  {list.map((b) => (
                    <details key={b.id} className="book-item">
                      <summary>
                        <b>{b.name}</b> · {fmtKRTime(b.startIso)}~{fmtKRTime(b.endIso)}
                      </summary>
                      <div className="book-detail">
                        <div>연락처: {b.phone}</div>
                        {b.notes && <div>메모: {b.notes}</div>}
                        <div>생성: {new Date(b.createdAt).toLocaleString('ko-KR')}</div>
                        <div>예약ID: {b.id}</div>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 서비스 미리보기: 주간 가용 확인 */}
      {view === 'preview' && currentRoom && (
        <div className="preview">
          <div className="pv-head">
            <button className="btn ghost" onClick={() => setView('list')}>
              〈 리스트로
            </button>
            <div className="pv-title">{currentRoom.name} · 주간 보기</div>
            <div className="pv-actions">
              <button className="btn ghost" onClick={openRoomSettings}>
                설정
              </button>
            </div>
          </div>

          {/* 사진 2장 A4 */}
          <div className="photos2">
            {[0, 1].map((i) => {
              const src = currentRoom.photos?.[i];
              return (
                <div className="a4box" key={i}>
                  {src ? (
                    <img className="a4img" src={src} alt="" />
                  ) : (
                    <div className="a4ph">이미지 준비중</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 주간 네비 */}
          <div className="week-toolbar">
            <button className="week-btn" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              〈 지난 주
            </button>
            <div className="week-range">
              {fmtKRDateLabel(weekDates[0])} ~ {fmtKRDateLabel(weekDates[6])}
            </div>
            <button className="week-btn" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              다음 주 〉
            </button>
          </div>

          {/* 주간 표: 날짜 헤더에 블랙아웃 토글 */}
          {weekLoading ? (
            <div>가용 정보를 불러오는 중...</div>
          ) : (
            <div className="week">
              <table className="week-table">
                <thead>
                  <tr>
                    {weekDates.map((d) => (
                      <th key={d}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6,
                          }}
                        >
                          <span>{fmtKRDateLabel(d)}</span>
                          <label className="switch" title="이 날짜를 예약불가로 전환">
                            <input
                              type="checkbox"
                              checked={!!weekBlackouts[d]}
                              onChange={(e) =>
                                saveBlackoutFor(d, currentRoom.id, e.currentTarget.checked)
                              }
                            />
                            <span className="slider" />
                          </label>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(weekAvail[weekDates[0]]?.slots || []).map((_, i) => (
                    <tr key={i} style={{ height: 48 }}>
                      {weekDates.map((d) => {
                        const cell = weekAvail[d]?.slots?.[i];
                        const cls = `cell ${cell?.status === 'booked' ? 'full' : ''}`;
                        return (
                          <td key={d} className={cls}>
                            {cell ? fmtRange(cell.isoStart, cell.isoEnd) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 단일 서비스 설정 (파일 업로드) */}
      {view === 'roomSettings' && currentRoom && (
        <div className="settings">
          <div className="pv-head">
            <button className="btn ghost" onClick={() => setView('preview')}>
              〈 미리보기
            </button>
            <div className="pv-title">{currentRoom.name} 설정</div>
            <div />
          </div>

          <div className="form">
            <label>서비스 이름</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
            />

            <label>시간당 비용(원)</label>
            <input
              className="input"
              type="number"
              value={form.hourlyPrice}
              onChange={(e) => setForm((v) => ({ ...v, hourlyPrice: Number(e.target.value) }))}
            />

            <label>서비스 인원수(예: 4 → 4인용)</label>
            <input
              className="input"
              type="number"
              value={form.capacity ?? ''}
              placeholder="미지정"
              onChange={(e) =>
                setForm((v) => ({
                  ...v,
                  capacity: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />

            <label>서비스 사진(파일 첨부)</label>
            <div className="uploader">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => uploadFiles(e.currentTarget.files)}
              />
              <div className="help">여러 장 선택 가능 • JPG/PNG 추천</div>
            </div>

            {/* 업로드된 사진 미리보기 + 삭제 */}
            {form.photos && form.photos.length > 0 && (
              <div className="grid">
                {form.photos.map((src, idx) => (
                  <div className="thumb" key={idx}>
                    <img src={src} alt="" />
                    <button className="del" onClick={() => removePhoto(idx)} title="삭제">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="row">
              <button className="btn" onClick={saveRoomSettings}>
                저장
              </button>
              <button className="btn ghost" onClick={() => setView('preview')}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 서비스 일람/편집(테이블) */}
      {view === 'settingsIndex' && (
        <div className="listedit">
          <div className="pv-head">
            <button className="btn ghost" onClick={() => setView('list')}>
              〈 관리자 홈
            </button>
            <div className="pv-title">서비스 설정</div>
            <div className="pv-actions">
              <button className="btn" onClick={saveSettingsIndex}>
                저장
              </button>
            </div>
          </div>

          <div className="table-head">
            <div className="col dragcol" />
            <div className="col name">이름</div>
            <div className="col price">시간당 비용</div>
            <div className="col cap">인원</div>
            <div className="col actions">작업</div>
          </div>

          <div className="rows">
            {editRooms.map((r, idx) => (
              <div
                key={r.id}
                className="rowitem"
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(idx)}
              >
                <div className="col dragcol" title="드래그로 순서 변경">
                  ≡
                </div>
                <div className="col name">
                  <input
                    className="input"
                    value={r.name}
                    onChange={(e) => updateEditRoom(idx, { name: e.target.value })}
                  />
                </div>
                <div className="col price">
                  <input
                    className="input"
                    type="number"
                    value={r.hourlyPrice}
                    onChange={(e) => updateEditRoom(idx, { hourlyPrice: Number(e.target.value) })}
                  />
                </div>
                <div className="col cap">
                  <input
                    className="input"
                    type="number"
                    value={r.capacity ?? ''}
                    placeholder="미지정"
                    onChange={(e) =>
                      updateEditRoom(idx, {
                        capacity: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <div className="col actions">
                  <div className="kebab">
                    <button className="kbtn" onClick={() => deleteService(idx)} title="삭제">
                      ⋯
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn ghost" onClick={addService}>
              + 서비스 추가
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-wrap {
          max-width: 1120px;
          margin: 0 auto;
          padding: 12px;
        }
        .admin-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          position: sticky;
          top: 0;
          background: #fff;
          padding: 8px 0;
          z-index: 5;
        }
        .title {
          font-weight: 900;
          font-size: 20px;
        }
        .date {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 8px 10px;
        }
        .btn {
          background: #2e90ff;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 8px 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn.ghost {
          background: transparent;
          color: #111827;
          border: 1px solid #e5e7eb;
        }

        .services {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 12px;
        }
        .svc-card {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 12px;
        }
        .svc-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .svc-name {
          font-weight: 900;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 16px;
        }
        .blk {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .blk-label {
          font-size: 12px;
          color: #374151;
        }
        .switch {
          position: relative;
          display: inline-block;
          width: 42px;
          height: 24px;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #e5e7eb;
          transition: 0.2s;
          border-radius: 999px;
        }
        .slider:before {
          position: absolute;
          content: '';
          height: 18px;
          width: 18px;
          left: 3px;
          top: 3px;
          background: white;
          transition: 0.2s;
          border-radius: 999px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        .switch input:checked + .slider {
          background: #2e90ff;
        }
        .switch input:checked + .slider:before {
          transform: translateX(18px);
        }

        .book-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .book-item {
          border: 1px solid #f3f4f6;
          border-radius: 10px;
          padding: 6px 10px;
          background: #fbfdff;
        }
        .book-item summary {
          cursor: pointer;
        }
        .book-detail {
          color: #374151;
          margin-top: 6px;
          line-height: 1.6;
        }
        .nores {
          color: #111827;
          font-weight: 800;
          padding: 6px 0;
        }

        .preview,
        .settings,
        .listedit {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 12px;
        }
        .pv-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .pv-title {
          font-weight: 900;
        }

        .photos2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 10px;
        }
        .a4box {
          width: 100%;
          aspect-ratio: 297/210;
          border: 1px solid #e5e7eb;
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

        .week-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 8px 0;
        }
        .week-btn {
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          border-radius: 10px;
          padding: 8px 10px;
          cursor: pointer;
        }
        .week {
          overflow: auto;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }
        .week-table {
          border-collapse: separate;
          border-spacing: 0;
          min-width: 100%;
        }
        .week-table th,
        .week-table td {
          border-bottom: 1px solid #e5e7eb;
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
          border: 2px solid transparent;
        }
        .cell.full {
          background: #fff5f5;
          color: #991b1b;
          border-color: #fecaca;
        }

        .form {
          display: grid;
          gap: 8px;
          max-width: 640px;
        }
        .input {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 8px 10px;
        }
        .uploader {
          border: 1px dashed #cbd5e1;
          border-radius: 12px;
          padding: 12px;
          background: #fbfdff;
        }
        .uploader input[type='file'] {
          display: block;
        }
        .uploader .help {
          color: #64748b;
          font-size: 12px;
          margin-top: 6px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
        }
        .thumb {
          position: relative;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }
        .thumb img {
          width: 100%;
          height: 120px;
          object-fit: cover;
          display: block;
        }
        .thumb .del {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 24px;
          height: 24px;
          border: none;
          border-radius: 999px;
          background: #111827;
          color: #fff;
          cursor: pointer;
        }

        .table-head,
        .rowitem {
          display: grid;
          grid-template-columns: 40px 1fr 160px 120px 80px;
          align-items: center;
          gap: 8px;
        }
        .table-head {
          font-weight: 900;
          padding: 6px 0;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 6px;
        }
        .rowitem {
          border: 1px solid #f3f4f6;
          border-radius: 10px;
          padding: 6px;
          margin-bottom: 8px;
          background: #fff;
        }
        .dragcol {
          text-align: center;
          cursor: grab;
          user-select: none;
        }
        .kebab {
          display: flex;
          justify-content: center;
        }
        .kbtn {
          width: 32px;
          height: 32px;
          border: 1px solid #e5e7eb;
          background: #fafafa;
          border-radius: 8px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
