declare module 'lunar-javascript' {
  interface SolarInstance {
    getLunar(): LunarInstance;
    toYmdHms(): string;
    getJulianDay(): number;
  }
  interface JieInstance { getName(): string; getSolar(): SolarInstance; }
  interface LunarInstance {
    getPrevJie(exact: boolean): JieInstance;
    getNextJie(exact: boolean): JieInstance;
    getDayInGanZhiExact(): string;
    getTimeGan(): string;
    getTimeXun(): string;
    getTimeXunKong(): string;
    getDayXunKongExact(): string;
    getDayXunExact(): string;
    getYearInGanZhiExact(): string;
    getMonthInGanZhiExact(): string;
    getTimeInGanZhi(): string;
    getMonthInChinese(): string;
    getDayInChinese(): string;
  }
  const lunar: {
    Solar: {
      fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): SolarInstance;
    };
  };
  export default lunar;
}
