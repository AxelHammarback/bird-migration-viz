const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const monthLabels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export const dayToMonthLabel = (dayOfYear: number) => {
  let day = Math.max(1, Math.min(365, Math.round(dayOfYear)));

  for (let index = 0; index < monthLengths.length; index += 1) {
    if (day <= monthLengths[index]) {
      return `${monthLabels[index]} ${day}`;
    }
    day -= monthLengths[index];
  }

  return "DEC 31";
};

export const windowLabel = (startDay: number, endDay: number) => {
  const start = dayToMonthLabel(startDay).split(" ")[0];
  const end = dayToMonthLabel(endDay).split(" ")[0];
  return `${start} - ${end}`;
};
