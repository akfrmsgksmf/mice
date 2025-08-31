// lib/types.ts

// 예약 슬롯(30분 단위)
export type Slot = {
  time: string;
  isoStart: string; // ISO with timezone offset
  isoEnd: string;
  status: 'free' | 'booked';
};

// 서비스(룸) 정의
export type Room = {
  id: number;
  name: string;
  hourlyPrice: number;
  photos: string[];
  capacity?: number; // 인원(예: 4 → 4인용)
  description?: string; // 선택 설명
};

// 전체 설정
export type Config = {
  openHour: number; // 0..24
  closeHour: number; // 0..24, close > open
  rooms: Room[];
  customerNotice?: string; // 고객 공지(선택)
};

// 예약 한 건
export type Booking = {
  id: string; // uuid
  roomId: number;
  date: string; // YYYY-MM-DD
  startIso: string; // iso with tz
  endIso: string;
  name: string;
  phone: string;
  notes?: string;
  source?: string;
  createdAt: string; // ISO
};

// API 에러 포맷
export type ApiError = { error: string };

// 블랙아웃 맵(선택 사용)
export type BlackoutMap = {
  [date: string]: { [roomId: string]: boolean };
};

// 특정 날짜의 가용 정보
export type Avail = {
  date: string;
  roomId: number;
  openHour: number;
  closeHour: number;
  slots: Slot[];
  closed?: boolean; // 블랙아웃이면 true (선택)
};
