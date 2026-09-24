import { SCHOOL_TIME_ZONE, schoolLocalToUtc } from "@/lib/activities";

export function getSchoolDay(now=new Date(),timeZone=SCHOOL_TIME_ZONE){
  const formatter=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"});
  const parts=Object.fromEntries(formatter.formatToParts(now).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
  const key=`${parts.year}-${parts.month}-${parts.day}`;
  const nextDate=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+1));
  const nextKey=`${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth()+1).padStart(2,"0")}-${String(nextDate.getUTCDate()).padStart(2,"0")}`;
  return {key,weekday:parts.weekday,start:new Date(schoolLocalToUtc(`${key}T00:00`,timeZone)),end:new Date(schoolLocalToUtc(`${nextKey}T00:00`,timeZone))};
}

export function isDailyLoginXpDay(weekday:string){return weekday!=="Sun"}

export function schoolDateEnd(value:string,timeZone=SCHOOL_TIME_ZONE){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error("INVALID_EXPIRATION");
  const date=new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate()+1);
  const next=`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`;
  return new Date(schoolLocalToUtc(`${next}T00:00`,timeZone));
}
