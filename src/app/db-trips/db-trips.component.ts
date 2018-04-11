import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { forkJoin } from 'rxjs/observable/forkJoin';

import * as moment from 'moment';
import { TimeFormatter } from '../db-aria/db-aria.component';

const API = 'https://scw.smartcommunitylab.it/es/gamification-stats-59a91478e4b0c9db6800afaf-*/_search';
const TYPES = ['Walk', 'Bike', 'PT'];
const MIN_DATE = moment('2017-09-10').toDate().getTime();

@Component({
  selector: 'app-db-trips',
  templateUrl: './db-trips.component.html',
  styleUrls: ['./db-trips.component.css']
})
export class DbTripsComponent implements OnInit {
  layers = {
    'Walk': 'mobility:trento_archi1day_walk',
    'Bike': 'mobility:trento_archi1day_bike',
    'PT': 'mobility:trento_archi1day_pubtrans',
    'total': 'mobility:trento_archi1day_total'
  };
  wmsURL = 'http://maps.dedagroup.it/geoserver/mobility/wms';
  wmsParams = {
    FORMAT: 'image/png',
    VERSION: '1.1.1',
    STYLES: '',
    LAYERS: this.layers['total']
  }; // layers

  currentType = 'total'; //Walk, Bike, PT or total
  currentLayer = this.layers['total'];
  monthChart: any;
  weekChart: any;
  dayChartWalk: any;
  dayChartBike: any;
  dayChartTP: any;
  playing = false;

  dayAggData = {}; // {"Bike": {"value": 67}, "Walk": {"value": 67}, "PT": {"value": 67}}
  // tslint:disable-next-line:max-line-length
  dayHistData = {}; // {"Walk": {"hour": [{"key_as_string":"1517803200000","key":1517803200000,"doc_count":2,"trips":{"value":2.0},"cumulative_trips":{"value":2.0}}, ...]}}
  monthData = [];

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
      }, 3000);
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
    // TODO?
  }

  constructor(
    private http: HttpClient,
  ) { }

  cardSelected(type: string) { //Walk, Bike, PT
    console.log('card clicked', type);
    const old = this.wmsParams;
    this.wmsParams = null;
    setTimeout(() => {
      if (this.currentLayer === this.layers[type]) {
        old.LAYERS = this.layers['total'];
        this.currentLayer = this.layers['total'];
        this.currentType = 'total';
      } else {
        old.LAYERS = this.layers[type];
        this.currentLayer = this.layers[type];
        this.currentType = type;
      }
      this.wmsParams = old;
    });
  }

  private updateData(event?: number) {
    if (event) {
      this.currentTime = event;
      this.currentSliderVal = moment(this.currentTime).diff(moment(MIN_DATE), 'days');
    }
    this.currentTimeFormatted = moment(this.currentTime).subtract(1, 'days').locale('it').format('DD MMM YYYY');
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
    this.getDayAgg('Walk', this.currentTime); // number of walk trips in the last day
    this.getDayAgg('Bike', this.currentTime); // number of bike trips in the last day
    this.getDayAgg('PT', this.currentTime); // number of PT trips in the last day
    this.getDayHist('Walk', 'hour', moment(day).toDate().getTime(), this.currentTime); // walk trips per hour in the last day
    this.getDayHist('Bike', 'hour', moment(day).toDate().getTime(), this.currentTime);
    this.getDayHist('PT', 'hour', moment(day).toDate().getTime(), this.currentTime);
    this.getMonthHist(moment(month).toDate().getTime(), this.currentTime);
  }

  /**
   * Get total number of trips of the given type in a day
   * @param type
   * @param date
   */
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

  getDayHist(type: string, agg: string, from: number, to: number) {
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
      // update day charts
      switch (type) {
        case 'Walk': {
          this.dayChartWalk = this.updateChart(this.dayChartWalk, 'Walk');
          break;
        }
        case 'Bike': {
          this.dayChartBike = this.updateChart(this.dayChartBike, 'Bike');
          break;
        }
        case 'PT': {
          this.dayChartTP = this.updateChart(this.dayChartTP, 'PT');
          break;
        }
      }
    });
  }

  getMonthHist(from: number, to: number) {
    const monthData = {};
    const newMonthData = [];
    // tslint:disable-next-line:max-line-length
    const walkQuery = {size: 0, query: {bool: {must : [ {match : {eventType : 'PointConcept'}}, {match : {conceptName : 'Walk_Trips'}}, { range : { executionTime : {from : from, to : to}}}]}},
    aggs : {trips_per_hours : { date_histogram : {field : 'executionTime', interval : 'day' }, aggs: {trips: {sum: {field: 'deltaScore'}}, cumulative_trips: { cumulative_sum: { buckets_path: 'trips' }}}}}};
    // tslint:disable-next-line:max-line-length
    const bikeQuery = {size: 0, query: {bool: {must : [ {match : {eventType : 'PointConcept'}}, {match : {conceptName : 'Bike_Trips'}}, { range : { executionTime : {from : from, to : to}}}]}},
    aggs : {trips_per_hours : { date_histogram : {field : 'executionTime', interval : 'day' }, aggs: {trips: {sum: {field: 'deltaScore'}}, cumulative_trips: { cumulative_sum: { buckets_path: 'trips' }}}}}};
    // tslint:disable-next-line:max-line-length
    const ptQuery = {size: 0, query: {bool: {must : [ {match : {eventType : 'PointConcept'}}, {bool : {should: [{match: {conceptName : 'Bus_Trips'}}, {match: {conceptName : 'Train_Trips'}}]}}, { range : { executionTime : {from : from, to : to}}}]}},
    aggs : {trips_per_hours : { date_histogram : {field : 'executionTime', interval : 'day' }, aggs: {trips: {sum: {field: 'deltaScore'}}, cumulative_trips: { cumulative_sum: { buckets_path: 'trips' }}}}}};

    const monthDataWalk = this.http.post(API, walkQuery);
    const monthDataBike = this.http.post(API, bikeQuery);
    const monthDataPT = this.http.post(API, ptQuery);

    forkJoin([monthDataWalk, monthDataBike, monthDataPT]).subscribe(results => {
      TYPES.forEach((t) => {
        if (!monthData[t]) { monthData[t] = []; }
        monthData[t] = results[TYPES.indexOf(t)]['aggregations'].trips_per_hours.buckets;
      });
      Object.keys(monthData).forEach(k => {
        monthData[k].forEach(e => {
          newMonthData.push({'resdate': moment(e.key).toDate().toISOString(), 'name': k, 'val': e.trips.value});
        });
      });
      this.monthData = newMonthData;
      this.updateMonthChart();
      this.updateWeekChart();
    });
  }

  private updateMonthChart() {
    const table = [['Day', 'Walk', 'Bike', 'TP']];
    const map = {};
    this.monthData.forEach((e) => {
      if (!map[e.resdate]) {map[e.resdate] = [0, 0, 0]; }
      const idx = TYPES.indexOf(e.name);
      if (idx >= 0) {map[e.resdate][idx] = e.val; }
    });
    Object.keys(map).forEach((d) => table.push([moment(d).locale('it').format('DD MMM')].concat(map[d])));
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
    const table = [['Day', 'Walk', 'Bike', 'PT']];
    const map = {};
    const start = moment(this.currentTime).subtract(7, 'days').format('YYYY-MM-DD');

    const week = this.monthData.filter((e) => e.resdate >= start);
    week.forEach((e) => {
      if (!map[e.resdate]) {map[e.resdate] = [0, 0, 0]; }
      const idx = TYPES.indexOf(e.name);
      if (idx >= 0) {map[e.resdate][idx] = e.val; }
    });

    Object.keys(map).forEach((d) => table.push([moment(d).locale('it').format('ddd DD')].concat(map[d])));
    if (this.weekChart) {
      this.weekChart = Object.create(this.weekChart);
      this.weekChart.dataTable = table;
    } else {
      this.weekChart = {
        chartType: 'ColumnChart',
        dataTable: table,
        options: {legend: 'none', height: 130, chartArea: {left: '6%', top: '5%', width: '100%', height: '79%'},
          hAxis: {textPosition: 'out'}, colors: ['#0000ff', '#ff0000', '#ff00ee']}
      };
    }
  }

  private updateChart(chart: any, attr: string) {
    const colors = {'Walk': '#0000ff', 'Bike': '#ff0000', 'PT': '#ff00ee'};
    const dayData = [];
    const filteredData = this.dayHistData[attr]['hour']; // [{"key_as_string":"1517803200000","key":1517803200000,"doc_count":2,"trips":{"value":2.0},"cumulative_trips":{"value":2.0}}, ...]
    filteredData.forEach((e) => {
      dayData.push({ 'value': String(e.trips.value), 'name': attr, 'resulttime': moment(e.key).toDate().toISOString() });
    });

    let table = [['Day', attr]];
    const day = dayData.filter((e) => e.name === attr).map((e) => [e.resulttime, parseFloat(e.value)]);
    day.forEach((e) => {
      const formattedTime = moment(e[0]).locale('it').format('HH:mm'); // ddd DD HH:mm
      e[0] = formattedTime;
    });
    table = table.concat(day);
    let newChart = null;
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
