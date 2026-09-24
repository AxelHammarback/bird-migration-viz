export type LandFeature = {
  type: "Feature";
  properties: { name: string };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

const polygon = (name: string, points: number[][]): LandFeature => ({
  type: "Feature",
  properties: { name },
  geometry: {
    type: "Polygon",
    coordinates: [[...points, points[0]]],
  },
});

export const landFeatures: LandFeature[] = [
  polygon("North America", [
    [-168, 70],
    [-140, 72],
    [-105, 66],
    [-70, 58],
    [-52, 47],
    [-62, 25],
    [-88, 15],
    [-112, 24],
    [-127, 36],
    [-150, 55],
  ]),
  polygon("South America", [
    [-82, 12],
    [-62, 8],
    [-44, -10],
    [-38, -28],
    [-54, -55],
    [-72, -44],
    [-79, -18],
  ]),
  polygon("Europe", [
    [-11, 36],
    [2, 50],
    [18, 58],
    [38, 56],
    [45, 45],
    [30, 36],
    [10, 36],
  ]),
  polygon("Africa", [
    [-18, 34],
    [12, 37],
    [35, 30],
    [48, 10],
    [36, -35],
    [12, -36],
    [-8, -20],
    [-17, 5],
  ]),
  polygon("Asia", [
    [35, 35],
    [55, 55],
    [95, 67],
    [142, 55],
    [152, 35],
    [128, 12],
    [105, 2],
    [78, 8],
    [58, 20],
  ]),
  polygon("Australia", [
    [112, -11],
    [154, -14],
    [153, -34],
    [136, -44],
    [115, -34],
  ]),
  polygon("Greenland", [
    [-52, 60],
    [-28, 70],
    [-32, 82],
    [-60, 84],
    [-73, 72],
  ]),
  polygon("Antarctica", [
    [-180, -66],
    [-120, -72],
    [-60, -68],
    [0, -74],
    [60, -68],
    [120, -72],
    [180, -66],
    [180, -86],
    [-180, -86],
  ]),
];
