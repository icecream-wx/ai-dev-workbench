import dayjs from "dayjs";

export function getElementsByClassName(className) {
  const els = [];
  for (let el of document.getElementsByClassName(className) || []) {
    els.push(el);
  }
  return els;
}

// 添加持续日期 cardListRaw => cardList
export function assembleData({ 
  cardListRaw = [], 
  startField, 
  endField 
}) {
  if(!startField) return cardListRaw
  cardListRaw.forEach((card) => {
    if(!card[startField]) return
    const start = dayjs(card[startField].value);
    if(!endField) {
      card.daysInTotal = 1
      return
    }
    if(!card[endField].value) {
      card[endField].value = start.format('YYYY-MM-DD')
      card.daysInTotal = 1
      return
    }
    const end = dayjs(card[endField].value);
    card.daysInTotal = end.diff(start, 'day') + 1
  })
  return cardListRaw;
}
