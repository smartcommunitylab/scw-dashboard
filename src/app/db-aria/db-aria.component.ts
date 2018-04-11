import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import * as moment from 'moment';

import { NouiFormatter } from 'nouislider';

export class TimeFormatter implements NouiFormatter {
  to(value: number): string {
    return moment(MIN_DATE).add(value, 'days').format('DD/MM/YYYY');
  }

  from(value: string): number {
    return moment(value, 'DD/MM/YYYY').diff(MIN_DATE, 'days');
  }
}

const API = 'https://am-test.smartcommunitylab.it/dss/services/ariadb';
const TYPES = ['PM10', 'PM2.5', 'SO2'];
const MIN_DATE = moment('2017-09-10').toDate().getTime();

@Component({
  selector: 'app-db-aria',
  templateUrl: './db-aria.component.html',
  styleUrls: ['./db-aria.component.css']
})
export class DbAriaComponent implements OnInit {

  currentStation = '7'; // Trento centro
  monthData = [];
  dayData = [];
  monthChart: any;
  weekChart: any;
  dayChartPM10: any;
  dayChartPM25: any;
  dayChartSO2: any;
  playing = false;

  stations: any[];
  stationData = {};

  /*****
   * START TIMER RELATED OPERATIONS
   *****/
  maxVal = moment().diff(MIN_DATE, 'days');
  currentSliderVal = 0;
  currentTime = MIN_DATE;
  currentTimeFormatted = moment(this.currentTime).subtract(1, 'days').locale('it').format('DD MMM YYYY');
  timer: any;

  public config: any = {
    range: {
      min: 0,
      max: this.maxVal
    },
    direction: 'rtl',
    step: 1,
    orientation: 'vertical',
    tooltips: new TimeFormatter(),
    pips: { mode: 'count', stepped: true, density: 2, values: 5, format: new TimeFormatter() }
  };

  onChange(value: any) {
    if (this.playing) {
      this.playPause();
    }
    const newCurrentTime = moment(MIN_DATE).add(value, 'days').toDate().getTime();
    this.updateData(newCurrentTime);
  }
  playPause() {
    if (this.playing) {
      clearInterval(this.timer);
      this.playing = false;
    } else {
      this.playing = true;
      this.timer = setInterval(() => {
        if (!moment(this.currentTime).isBefore(moment(), 'day')) { this.currentTime = MIN_DATE; }
        this.updateData(moment(this.currentTime).add(1, 'days').toDate().getTime());
      }, 1000);
    }
  }
  /*****
   * END TIMER RELATED OPERATIONS
   *****/

  ngOnInit() {
    this.updateData(null);
    this.initMap();
  }

  initMap() {
    this.http.get(`${API}/Stations`)
    .subscribe((data) => {
      this.stations = (data as any).Entries.Entry;
    });
  }

  constructor(
    private http: HttpClient,
  ) { }

  stationSelected(station: any) {
    console.log('clicked', station);
    if (station.id !== this.currentStation) {
      if (this.playing) {
        this.playPause();
      }
      this.currentStation = station.id;
      this.updateData();
    }
  }

  private updateData(event?: number) {
    if (event) {
      this.currentTime = event;
      this.currentSliderVal = moment(this.currentTime).diff(moment(MIN_DATE), 'days');
    }
    const now = moment(this.currentTime);
    if (now.isDST()) { now.subtract(2, 'hours'); } else { now.subtract(1, 'hours'); }
    const month = moment(now).subtract(30, 'days').format('YYYY-MM-DD HH:mm');
    const day = moment(now).subtract(1, 'days').format('YYYY-MM-DD HH:mm');
    const to = now.format('YYYY-MM-DD HH:mm');
    // last month for current station (week and month view)
    this.http.get(`${API}/PeriodData/${this.currentStation}?fromTime=${month}&toTime=${to}`)
    .subscribe((data) => {
      this.monthData = (data as any).Result.Element;
      if (this.monthData && typeof this.monthData !== undefined){
        this.updateMonthChart();
        this.updateWeekChart();
        this.updateStations();
      }
    });
    // last day for current station (day view)
    this.http.get(`${API}/Day/${this.currentStation}?fromTime=${day}&toTime=${to}`)
    .subscribe((data) => {
      this.dayData = (data as any).Entries.Entry;
      if (this.dayData && typeof this.dayData !== undefined) {
        this.dayChartPM10 = this.updateChart(this.dayChartPM10, 'PM10');
        this.dayChartPM25 = this.updateChart(this.dayChartPM25, 'PM2.5');
        this.dayChartSO2 = this.updateChart(this.dayChartSO2, 'SO2');
      }
    });
    // aggregate data for last day
    this.http.get(`${API}/AggData?fromTime=${day}&toTime=${to}`)
    .subscribe((data) => {
      const stationData = (data as any).Entries.Entry;
      // in service result the station ID is represented as resulttime
      if (stationData && typeof stationData !== undefined) {
        stationData.forEach((sd) => {
          if (!this.stationData[sd.resulttime]) { this.stationData[sd.resulttime] = {}; }
          this.stationData[sd.resulttime][sd.name] = sd.value;
        });
        Object.keys(this.stationData).forEach((key) => {
          this.stationData[key].caqi = this.computeCaqi(this.stationData[key]);
          this.stationData[key].style = 'level' + this.stationData[key].caqi;
        });
      }
    });
  }

  computeCaqi(data: any): number {
    let NO2 = parseFloat(data.NO2) || 0;
    let O3 = parseFloat(data.O3) || 0;
    let PM10 = parseFloat(data.PM10) || 0;
    let PM25 = parseFloat(data['PM2.5']) || 0;
    NO2 = NO2 < 50 ? 1 : NO2 < 100 ? 2 : NO2 < 200 ? 3 : NO2 < 400 ? 4 : 5;
    O3 = O3 < 60 ? 1 : O3 < 120 ? 2 : O3 < 180 ? 3 : O3 < 240 ? 4 : 5;
    PM10 = PM10 < 25 ? 1 : PM10 < 50 ? 2 : PM10 < 90 ? 3 : PM10 < 180 ? 4 : 5;
    PM25 = PM25 < 15 ? 1 : PM25 < 30 ? 2 : PM25 < 55 ? 3 : PM25 < 110 ? 4 : 5;
    return Math.max(NO2, O3, PM10, PM25);
  }

  // needed?
  private updateStations() {
    const start = moment(this.currentTime).format('YYYY-MM-DD');
    const day = this.monthData.filter((e) => e.resdate >= start);
  }

  private updateMonthChart() {
    const table = [['Day', 'PM10', 'PM2.5', 'SO2']];
    const map = {};
    this.monthData.forEach((e) => {
      if (!map[e.resdate]) {map[e.resdate] = [0, 0, 0]; }
      const idx = TYPES.indexOf(e.name);
      if (idx >= 0) {map[e.resdate][idx] = e.val; }
    });
    Object.keys(map).forEach((d) => table.push([moment(d, 'YYYY-MM-DDZ').locale('it').format('DD MMM')].concat(map[d])));
    if (this.monthChart) {
      this.monthChart = Object.create(this.monthChart);
      this.monthChart.dataTable = table;
    } else {
      this.monthChart = {
        chartType: 'LineChart',
        dataTable: table,
        options: {legend: 'none', height: 130, chartArea: {left: '3.5%', top: '5%', width: '95%', height: '79%'},
          hAxis: {textPosition: 'out', showTextEvery: 5}, colors: ['#0000ff', '#ff0000', '#ff00ee']}
      };
    }
  }

  private updateWeekChart() {
    const table = [['Day', 'PM10', 'PM2.5', 'SO2']];
    const map = {};
    const start = moment(this.currentTime).subtract(7, 'days').format('YYYY-MM-DD');

    const week = this.monthData.filter((e) => e.resdate >= start);
    if (week.length > 0) {
      week.forEach((e) => {
        if (!map[e.resdate]) { map[e.resdate] = [0, 0, 0]; }
        const idx = TYPES.indexOf(e.name);
        if (idx >= 0) { map[e.resdate][idx] = e.val; }
      });

      Object.keys(map).forEach((d) => table.push([moment(d, 'YYYY-MM-DDZ').locale('it').format('ddd DD')].concat(map[d])));
      if (this.weekChart) {
        this.weekChart = Object.create(this.weekChart);
        this.weekChart.dataTable = table;
      } else {
        this.weekChart = {
          chartType: 'ColumnChart',
          dataTable: table,
          options: {
            legend: 'none', height: 130, chartArea: { left: '6%', top: '5%', width: '100%', height: '79%' },
            hAxis: { textPosition: 'out' }, colors: ['#0000ff', '#ff0000', '#ff00ee']
          }
        };
      }
    }
  }

  private updateChart(chart: any, attr: string) {
    this.currentTimeFormatted = moment(this.currentTime).subtract(1, 'days').locale('it').format('DD MMM YYYY');
    const colors = {'PM10': '#0000ff', 'PM2.5': '#ff0000', 'SO2': '#ff00ee'};
    let table = [['Day', attr]];
    let newChart = null;
    const day = this.dayData.filter((e) => e.name === attr).map((e) => [e.resulttime, parseFloat(e.value)]);
    day.forEach((e) => {
      const formattedTime = moment(e[0]).locale('it').format('HH:mm');
      e[0] = formattedTime;
    });
    table = table.concat(day);
    if (table.length <= 1) {
      return newChart;
    }

    if (chart) {
      newChart = Object.create(chart);
      newChart.dataTable = table;
    } else {
      newChart = {
        chartType: 'LineChart',
        dataTable: table,
        options: {legend: 'none', height: 90, chartArea: {left: '6%', top: '5%', width: '100%', height: '79%'},
          hAxis: {textPosition: 'out', showTextEvery: 6}, colors: [colors[attr]]}
      };
    }
    return newChart;
  }
}
