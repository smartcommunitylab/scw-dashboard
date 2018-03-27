import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import * as moment from 'moment';

import { NouiFormatter } from 'nouislider';

export class TimeFormatter implements NouiFormatter {
  to(value: number): string {
    return moment(new Date(value)).format('DD/MM/YYYY');
  }

  from(value: string): number {
    return moment(value).toDate().getTime();
  }
}

const API = 'https://am-test.smartcommunitylab.it/dss/services/ariadb';
const TYPES = ['PM10', 'PM2.5', 'SO2'];

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
  dayCharts = {};
  playing = false;

  stations: any[];
  stationData = {};

  /*****
   * START TIMER RELATED OPERATIONS
   *****/
  minDate = moment('2017-09-10').toDate().getTime();
  maxDate = moment().toDate().getTime();
  step = 1000 * 60 * 60 * 24;
  currentTime = this.minDate;
  timer: any;

  public config: any = {
    range: {
      min: this.minDate,
      max: this.maxDate
    },
    direction: 'rtl',
    step: this.step,
    orientation: 'vertical',
    tooltips: new TimeFormatter(),
    pips: { mode: 'count', stepped: true, density: 2, values: 5, format: new TimeFormatter() }
  };

  onChange(value: any) {
    if (this.playing) {
      this.playPause();
    }
    this.updateData(value);
  }
  playPause() {
    if (this.playing) {
      clearInterval(this.timer);
      this.playing = false;
    } else {
      this.playing = true;
      this.timer = setInterval(() => {
        if (!moment(this.currentTime).isBefore(moment(), 'day')) { this.currentTime = this.minDate; }
        this.updateData(this.currentTime + 1000 * 60 * 60 * 24);
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

  private updateData(event?: number) {
    if (event) { this.currentTime = event; }
    const now = moment(this.currentTime);
    const month = moment(now).subtract(30, 'days').format('YYYY-MM-DD HH:mm');
    const day = moment(now).subtract(1, 'days').format('YYYY-MM-DD HH:mm');
    const to = now.format('YYYY-MM-DD HH:mm');
    // last month for current station (week and month view)
    this.http.get(`${API}/PeriodData/${this.currentStation}?fromTime=${month}&toTime=${to}`)
    .subscribe((data) => {
      this.monthData = (data as any).Result.Element;
      this.updateMonthChart();
      this.updateWeekChart();
      this.updateStations();
    });
    // last day for current station (day view)
    this.http.get(`${API}/Day/${this.currentStation}?fromTime=${day}&toTime=${to}`)
    .subscribe((data) => {
      this.dayData = (data as any).Entries.Entry;
      this.updateDayChart('PM10');
      this.updateDayChart('PM2.5');
      this.updateDayChart('SO2');
    });
    // aggregate data for last day
    this.http.get(`${API}/AggData?fromTime=${day}&toTime=${to}`)
    .subscribe((data) => {
      const stationData = (data as any).Entries.Entry;
      // in service result the station ID is represented as resulttime
      stationData.forEach((sd) => {
        if (!this.stationData[sd.resulttime]) { this.stationData[sd.resulttime] = {}; }
        this.stationData[sd.resulttime][sd.name] = sd.value;
      });
      Object.keys(this.stationData).forEach((key) => {
        this.stationData[key].caqi = this.computeCaqi(this.stationData[key]);
        this.stationData[key].style = 'level' + this.stationData[key].caqi;
      });
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
    Object.keys(map).forEach((d) => table.push([d].concat(map[d])));
    if (this.monthChart) {
      this.monthChart = Object.create(this.monthChart);
      this.monthChart.dataTable = table;
    } else {
      this.monthChart = {
        chartType: 'LineChart',
        dataTable: table,
        options: {legend: 'none', height: 130, chartArea: {left: 0, top: 0, width: '100%', height: 120}, hAxis: {textPosition: 'none'}}
      };
    }
  }

  private updateWeekChart() {
    const table = [['Day', 'PM10', 'PM2.5', 'SO2']];
    const map = {};
    const start = moment(this.currentTime).subtract(7, 'days').format('YYYY-MM-DD');

    const week = this.monthData.filter((e) => e.resdate >= start);
    week.forEach((e) => {
      if (!map[e.resdate]) {map[e.resdate] = [0, 0, 0]; }
      const idx = TYPES.indexOf(e.name);
      if (idx >= 0) {map[e.resdate][idx] = e.val; }
    });
    Object.keys(map).forEach((d) => table.push([d].concat(map[d])));
    if (this.weekChart) {
      this.weekChart = Object.create(this.weekChart);
      this.weekChart.dataTable = table;
    } else {
      this.weekChart = {
        chartType: 'ColumnChart',
        dataTable: table,
        options: {legend: 'none', height: 130, chartArea: {left: 0, top: 0, width: '100%', height: 120}, hAxis: {textPosition: 'none'}}
      };
    }
  }

  private updateDayChart(attr: string) {
    let table = [['Day', attr]];
    const day = this.dayData.filter((e) => e.name === attr).map((e) => [e.resulttime, parseFloat(e.value)]);
    table = table.concat(day);
    if (this.dayCharts[attr]) {
      this.dayCharts[attr] = Object.create(this.dayCharts);
      this.dayCharts[attr].dataTable = table;
    } else {
      this.dayCharts[attr] = {
        chartType: 'LineChart',
        dataTable: table,
        options: {legend: 'none', height: 90, chartArea: {left: 0, top: 0, width: '100%', height: 80}, hAxis: {textPosition: 'none'}}
      };
    }
  }
}