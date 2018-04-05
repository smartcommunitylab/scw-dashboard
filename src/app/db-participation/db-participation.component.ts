import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { forkJoin } from "rxjs/observable/forkJoin";

import * as moment from 'moment';
import { TimeFormatter } from '../db-aria/db-aria.component';

const API = 'https://scw.smartcommunitylab.it/es/gamification-stats-59a91478e4b0c9db6800afaf-*/';
const TYPES = ['Registrati', 'Attivi', 'Azioni'];

@Component({
  selector: 'app-db-participation',
  templateUrl: './db-participation.component.html',
  styleUrls: ['./db-participation.component.css']
})
export class DbParticipationComponent implements OnInit {

  currentCity = 'Trento'; //Trento/Rovereto
  monthChart: any;
  weekChart: any;
  dayChartRegistrati: any;
  dayChartAttivi: any;
  dayChartAzioni: any;
  playing = false;

  dayAggData = {} //{"Trento": {"Attivi": 31, "Registrati": 32, "Azioni": 33}. "Rovereto": {...}}
  dayHistData = {}
  monthData = [];

  cities = [
    { "name": "Trento", "X": "46.0805591", "Y": "11.0503148"},
    { "name": "Rovereto", "X": "45.8833074", "Y": "10.9664293"}
  ];

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
    console.log(this.dayAggData[this.currentCity]);
  }

  initMap() {

  }

  constructor(
    private http: HttpClient,
  ) { }

  /**
   * Called when a city on the map is clicked, causes data update for the charts
   * @param city 
   */
  citySelected(city: any) {
    console.log('clicked', city);
    if (city.name !== this.currentCity) {
      if (this.playing) {
        this.playPause();
      }
      this.currentCity = city.name;
      this.updateData();
    }
  }

  private updateData(event?: number) {
    if (event) { this.currentTime = event; }
    const now = moment(this.currentTime);
    const month = moment(now).subtract(30, 'days').format('YYYY-MM-DD HH:mm');
    const day = moment(now).subtract(1, 'days').format('YYYY-MM-DD HH:mm');
    const to = now.format('YYYY-MM-DD HH:mm');

    // tslint:disable-next-line:max-line-length
    this.getDayAgg('Registrati', this.currentTime, this.currentCity); //number of users who registered in the last day
    this.getDayAgg('Attivi', this.currentTime, this.currentCity); //number of active users in the last day
    this.getDayAgg('Azioni', this.currentTime, this.currentCity); //number of actions in the last day
    this.getDayHist('Registrati', moment(day).toDate().getTime(), this.currentTime, this.currentCity); //users registered throughout the last day
    this.getDayHist('Attivi', moment(day).toDate().getTime(), this.currentTime, this.currentCity);
    this.getDayHist('Azioni', moment(day).toDate().getTime(), this.currentTime, this.currentCity);
    this.getMonthHist(this.currentCity, moment(month).toDate().getTime(), this.currentTime);
    /*
    // last month for current station (week and month view)
    this.http.get(`${API}/PeriodData/${this.currentStation}?fromTime=${month}&toTime=${to}`)
    .subscribe((data) => {
      this.monthData = (data as any).Result.Element;
      this.updateMonthChart();
      this.updateWeekChart();
      this.updateStations();
    });
    */
  }

  //needed?
  private updateStations() {
    const start = moment(this.currentTime).format('YYYY-MM-DD');
    const day = this.monthData.filter((e) => e.resdate >= start);
  }

  /*****
   * FUNCTIONS THAT QUERY ELASTICSEARCH
   *****/
  getDayAgg(type: string, date: number, residence: string) {
    const from = date - 1000 * 60 * 60 * 24;
    let daySumQuery = null;
    if (type === 'Attivi') {
      // tslint:disable-next-line:max-line-length
      daySumQuery = {query: {bool: {must : [ {match : {eventType : 'Action'}}, {match : {residence : residence}}, { range : { executionTime : {from : from, to : date}}}]}},
      size: 0, aggs: {unique_players: {cardinality: {field : 'playerId'}}}};

      this.http.post(API + '_search', daySumQuery).subscribe((res: any) => {
        if (!this.dayAggData[residence]) { this.dayAggData[residence] = {}; }
        this.dayAggData[residence][type] = res.aggregations.unique_players.value;
        Object.keys(this.dayAggData).forEach((key) => {
          //this.dayAggData[key].part_index = this.computePartIndex();
          this.dayAggData[key].style = 'level1';// + this.dayAggData[key].part_index;
        });
      });
    } else {
      // tslint:disable-next-line:max-line-length
      daySumQuery = { query: { bool: { must: [{ match: { eventType: (type == 'Registrati' ? 'UserCreation' : 'Action') } }, { match: { residence: residence } }, { range: { executionTime: { from: from, to: date } } }] } } };
      
      this.http.post(API + '_count', daySumQuery).subscribe((res: any) => {
        if (!this.dayAggData[residence]) { this.dayAggData[residence] = {}; }
        this.dayAggData[residence][type] = res.count;
        Object.keys(this.dayAggData).forEach((key) => {
          //this.dayAggData[key].part_index = this.computePartIndex(); //TODO
          this.dayAggData[key].style = 'level1';// + this.dayAggData[key].part_index; //da level1 a level5
        });
      });
    }
  }

  getDayHist(type: string, from: number, to: number, residence: string) {
    let daySumQuery = null;
    switch (type) {
      case 'Registrati': {
        // tslint:disable-next-line:max-line-length
        daySumQuery = {size: 0, query: {bool: {must: [{match: {eventType : 'UserCreation'}},{match: {residence : residence}},{range: {executionTime : {from: from, to : to}}}]}},
        aggs : {by_date: {date_histogram: {field : 'executionTime', interval : 'hour'}, aggs: {operations: {value_count: {field : 'playerId'}}, cumulative_operations: {cumulative_sum: {buckets_path : 'operations'}}}}}};
        
        this.http.post(API + '_search', daySumQuery).subscribe((res: any) => {
          if (!this.dayHistData[type]) { this.dayHistData[type] = {}; }
          this.dayHistData[type] = res.aggregations.by_date.buckets; //dayHistData = {"Registrati": [{"key": 1234567890000, "unique_players": {"value": 3}}]}
          //update day charts
          this.dayChartRegistrati = this.updateChart(this.dayChartRegistrati, 'Registrati');
        });
        break;
      }
      case 'Attivi': {
        // tslint:disable-next-line:max-line-length
        daySumQuery = {size: 0, query: {bool: {must: [{match: {eventType : 'Action'}},{match: {residence : residence}},{range: {executionTime : {from: from, to : to}}}]}},
        aggs : {by_date: {date_histogram: {field : 'executionTime', interval : 'hour'}, aggs: {operations: {value_count: {field : 'playerId'}}, cumulative_operations: {cumulative_sum: {buckets_path : 'operations'}}}}}};
        
        this.http.post(API + '_search', daySumQuery).subscribe((res: any) => {
          if (!this.dayHistData[type]) { this.dayHistData[type] = {}; }
          this.dayHistData[type] = res.aggregations.by_date.buckets; //dayHistData = {"Registrati": [{"key": 1234567890000, "unique_players": {"value": 3}}]}
          //update day charts
          this.dayChartAttivi = this.updateChart(this.dayChartAttivi, 'Attivi');
        });
        break;
      }
      case 'Azioni': {
        // tslint:disable-next-line:max-line-length
        daySumQuery = {size: 0, query: {bool: {must: [{match: {eventType : 'Action'}},{match: {residence : residence}},{range: {executionTime : {from: from, to : to}}}]}},
        aggs : {by_date: {date_histogram: {field : 'executionTime', interval : 'hour'}, aggs: {operations: {cardinality: {field : 'playerId'}}, cumulative_operations: {cumulative_sum: {buckets_path : 'operations'}}}}}};
        
        this.http.post(API + '_search', daySumQuery).subscribe((res: any) => {
          if (!this.dayHistData[type]) { this.dayHistData[type] = {}; }
          this.dayHistData[type] = res.aggregations.by_date.buckets; //dayHistData = {"Registrati": [{"key": 1234567890000, "unique_players": {"value": 3}}]}
          //update day charts
          this.dayChartAzioni = this.updateChart(this.dayChartAzioni, 'Azioni');
        });
        break;
      }
    }
  }

  private getMonthHist(residence: string, from: number, to: number) {
    let monthData = {};
    // tslint:disable-next-line:max-line-length
    let regQuery = {size: 0, query: {bool: {must: [{match: {eventType : 'UserCreation'}},{match: {residence : residence}},{range: {executionTime : {from: from, to : to}}}]}},
    aggs : {by_date: {date_histogram: {field : 'executionTime', interval : 'day'}, aggs: {operations: {value_count: {field : 'playerId'}}, cumulative_operations: {cumulative_sum: {buckets_path : 'operations'}}}}}};
    // tslint:disable-next-line:max-line-length
    let attQuery = {size: 0, query: {bool: {must: [{match: {eventType : 'Action'}},{match: {residence : residence}},{range: {executionTime : {from: from, to : to}}}]}},
    aggs : {by_date: {date_histogram: {field : 'executionTime', interval : 'day'}, aggs: {operations: {cardinality: {field : 'playerId'}}, cumulative_operations: {cumulative_sum: {buckets_path : 'operations'}}}}}};
    // tslint:disable-next-line:max-line-length
    let azQuery = {size: 0, query: {bool: {must: [{match: {eventType : 'Action'}},{match: {residence : residence}},{range: {executionTime : {from: from, to : to}}}]}},
    aggs : {by_date: {date_histogram: {field : 'executionTime', interval : 'day'}, aggs: {operations: {value_count: {field : 'playerId'}}, cumulative_operations: {cumulative_sum: {buckets_path : 'operations'}}}}}};

    let monthDataRegistrati = this.http.post(API + '_search', regQuery);
    let monthDataAttivi = this.http.post(API + '_search', attQuery);
    let monthDataAzioni = this.http.post(API + '_search', azQuery);

    forkJoin([monthDataRegistrati, monthDataAttivi, monthDataAzioni]).subscribe(results => {
      TYPES.forEach((t) => {
        if (!monthData[t]) { monthData[t] = []; }
        monthData[t] = results[TYPES.indexOf(t)]['aggregations'].by_date.buckets;
      });
      console.log(monthData);
      Object.keys(monthData).forEach(k => {
        monthData[k].forEach(e => {
          this.monthData.push({'resdate': moment(e.key).toDate().toISOString(), 'name': k, 'val': e.operations.value});
        });
      });
      console.log('month', this.monthData);
      this.updateMonthChart();
      this.updateWeekChart();
    });
  }
  
  /*****
   * FUNCTIONS THAT UPDATE CHARTS
   *****/

  private updateMonthChart() {
    const table = [['Day', 'Registrati', 'Attivi', 'Azioni']];
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
    const table = [['Day', 'Registrati', 'Attivi', 'Azioni']];
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
    let dayData = [];
    //console.log(this.dayHistData)
    this.dayHistData[attr].forEach((e) => {
      dayData.push({ "value": String(e.operations.value), "name": attr, "resulttime": moment(e.key).toDate().toISOString() });
    });

    let table = [['Day', attr]];
    const day = dayData.filter((e) => e.name === attr).map((e) => [e.resulttime, parseFloat(e.value)]);
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
        options: {legend: 'none', height: 90, chartArea: {left: 0, top: 0, width: '100%', height: 80}, hAxis: {textPosition: 'none'}}
      };
    }
    return newChart;
  }
}
