declare module "jalaali-js" {
  const jalaali: {
    toJalaali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number };
    toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number };
    jalaaliMonthLength(jy: number, jm: number): number;
  };
  export default jalaali;
}
