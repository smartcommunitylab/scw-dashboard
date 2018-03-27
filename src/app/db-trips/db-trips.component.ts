import { Component, OnInit } from '@angular/core';

import * as moment from 'moment';
import { TimeFormatter } from '../db-aria/db-aria.component';
import { HttpClient } from '@angular/common/http';

const API = 'https://scw.smartcommunitylab.it/es';
const TYPES = ['Bike', 'Walk', 'PT'];

@Component({
  selector: 'app-db-trips',
  templateUrl: './db-trips.component.html',
  styleUrls: ['./db-trips.component.css']
})
export class DbTripsComponent implements OnInit {

  wmsURL = 'http://maps.dedagroup.it/geoserver/mobility/wms';
  wmsParams = {
    FORMAT: 'image/png',
    VERSION: '1.1.1',
    STYLES: '',
    LAYERS: 'mobility:trento_archi1day'
  };

  currentStation = '7'; // Trento centro
  monthData = [];
  dayData = [];
  monthChart: any;
  weekChart: any;
  dayChartBike: any;
  dayChartWalk: any;
  dayChartTP: any;
  playing = false;

  cities: any[];
  cityData = {};

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
      }, 2000);
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
    const old = this.wmsParams;
    this.wmsParams = null;
    setTimeout (() => {
      this.wmsParams = old;
      this.wmsParams['TIME'] = now.toDate().toISOString();
    });
    // last month for current station (week and month view)
    // this.http.get(`${API}/PeriodData/${this.currentStation}?fromTime=${month}&toTime=${to}`)
    // .subscribe((data) => {
    //   this.monthData = (data as any).Result.Element;
    //   this.updateMonthChart();
    //   this.updateWeekChart();
    //   this.updatecities();
    // });
    // // last day for current station (day view)
    // this.http.get(`${API}/Day/${this.currentStation}?fromTime=${day}&toTime=${to}`)
    // .subscribe((data) => {
    //   this.dayData = (data as any).Entries.Entry;
    //   this.dayChartPM10 = this.updateChart(this.dayChartPM10, 'PM10');
    //   this.dayChartPM25 = this.updateChart(this.dayChartPM25, 'PM2.5');
    //   this.dayChartSO2 = this.updateChart(this.dayChartSO2, 'SO2');
    // });
    // // aggregate data for last day
    // this.http.get(`${API}/AggData?fromTime=${day}&toTime=${to}`)
    // .subscribe((data) => {
    //   const cityData = (data as any).Entries.Entry;
    //   // in service result the station ID is represented as resulttime
    //   cityData.forEach((sd) => {
    //     if (!this.cityData[sd.resulttime]) { this.cityData[sd.resulttime] = {}; }
    //     this.cityData[sd.resulttime][sd.name] = sd.value;
    //   });
    //   Object.keys(this.cityData).forEach((key) => {
    //     this.cityData[key].caqi = this.computeCaqi(this.cityData[key]);
    //     this.cityData[key].style = 'level' + this.cityData[key].caqi;
    //   });
    // });
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

  private updatecities() {
    const start = moment(this.currentTime).format('YYYY-MM-DD');
    const day = this.monthData.filter((e) => e.resdate >= start);
  }

  private updateMonthChart() {
    const table = [['Day', 'Bike', 'Walk', 'PT']];
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
    const table = [['Day', 'Bike', 'Walk', 'PT']];
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

  private updateChart(chart: any, attr: string) {
    let table = [['Day', attr]];
    const day = this.dayData.filter((e) => e.name === attr).map((e) => [e.resulttime, parseFloat(e.value)]);
    table = table.concat(day);
    let newChart = null;
    if (chart) {
      newChart = Object.create(chart);
      newChart.dataTable = table;
    } else {
      newChart = {
        chartType: 'LineChart',
        dataTable: table,
        options: {legend: 'none', height: 90, chartArea: {left: 0, top: 0, width: '100%', height: 80}, hAxis: {textPosition: 'none'}}
      };
    }
    return newChart;
  }
}
