import { Component, OnInit } from '@angular/core';

import * as moment from 'moment';
import { TimeFormatter } from '../db-aria/db-aria.component';
import { HttpClient } from '@angular/common/http';

const API = 'https://scw.smartcommunitylab.it/es/gamification-stats-59a91478e4b0c9db6800afaf-*/_search';
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

  dayAggData = {};
  dayHistData = {};

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
    // update Map data
    const old = this.wmsParams;
    this.wmsParams = null;
    setTimeout (() => {
      this.wmsParams = old;
      this.wmsParams['TIME'] = now.toDate().toISOString();
    });

    // tslint:disable-next-line:max-line-length
    this.getDayAgg('Walk', this.currentTime);
    this.getDayAgg('Bike', this.currentTime);
    this.getDayAgg('PT', this.currentTime);
    this.getHist('Walk', 'day', moment(month).toDate().getTime(), this.currentTime);
    this.getHist('Bike', 'day', moment(month).toDate().getTime(), this.currentTime);
    this.getHist('PT', 'day', moment(month).toDate().getTime(), this.currentTime);
    this.getHist('Walk', 'hour', moment(day).toDate().getTime(), this.currentTime);
    this.getHist('Bike', 'hour', moment(day).toDate().getTime(), this.currentTime);
    this.getHist('PT', 'hour', moment(day).toDate().getTime(), this.currentTime);
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

  getDayAgg(type: string, date: number) {
    const from = date - 1000 * 60 * 60 * 24;
    let daySumQuery = null;
    if (type !== 'PT') {
      // tslint:disable-next-line:max-line-length
      daySumQuery = {query: {bool: {must : [ {match : {eventType : 'PointConcept'}}, {match : {conceptName : type + '_Trips'}}, { range : { executionTime : {from : from, to : date}}}]}},
      aggs : {total : { sum : { field : 'deltaScore' } }}};
    } else {
      // tslint:disable-next-line:max-line-length
      daySumQuery = {query: {bool: {must : [ {match : {eventType : 'PointConcept'}}, { bool : {should : [{ match : {conceptName : 'Bus_Trips'} }, { match : {conceptName : 'Train_Trips'} } ] } }, { range : { executionTime : {from : from, to : date}}}]}},
      aggs : {total : { sum : { field : 'deltaScore' } }}};
    }
    this.http.post(API, daySumQuery).subscribe((res: any) => {
      this.dayAggData[type] = res.aggregations.total;
    });
  }

  getHist(type: string, agg: string, from: number, to: number) {
    let daySumQuery = null;
    if (type !== 'PT') {
      // tslint:disable-next-line:max-line-length
      daySumQuery = {size: 0, query: {bool: {must : [ {match : {eventType : 'PointConcept'}}, {match : {conceptName : type + '_Trips'}}, { range : { executionTime : {from : from, to : to}}}]}},
      aggs : {trips_per_hours : { date_histogram : {field : 'executionTime', interval : agg },
      aggs: {trips: {sum: {field: 'deltaScore'}}, cumulative_trips: { cumulative_sum: { buckets_path: 'trips' }}}}}};
    } else {
      // tslint:disable-next-line:max-line-length
      daySumQuery = {size: 0, query: {bool: {must : [ {match : {eventType : 'PointConcept'}}, { bool : {should : [{ match : {conceptName : 'Bus_Trips'} }, { match : {conceptName : 'Train_Trips'} } ] } }, { range : { executionTime : {from : from, to : to}}}]}},
      aggs : {trips_per_hours : { date_histogram : {field : 'executionTime', interval : agg },
      aggs: {trips: {sum: {field: 'deltaScore'}}, cumulative_trips: { cumulative_sum: { buckets_path: 'trips' }}}}}};
    }
    this.http.post(API, daySumQuery).subscribe((res: any) => {
      if (!this.dayHistData[type]) { this.dayHistData[type] = {}; }
      this.dayHistData[type][agg] = res.aggregations.trips_per_hours.buckets;
    });
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
