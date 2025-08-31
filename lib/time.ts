export function generateHalfHourLabels(openHour:number, closeHour:number){
  const out:string[]=[];
  for(let h=openHour; h<closeHour; h++){
    out.push(`${String(h).padStart(2,"0")}:00`, `${String(h).padStart(2,"0")}:30`);
  }
  return out;
}
export function toLocalOffsetISO(d:Date){
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0,19);
}
