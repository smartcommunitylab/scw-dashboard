import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { NavComponent } from './nav/nav.component';
import { DbAriaComponent } from './db-aria/db-aria.component';
import { DbTripsComponent } from './db-trips/db-trips.component';
import { DbParticipationComponent } from './db-participation/db-participation.component';
import { FooterComponent } from './footer/footer.component';

import { NouisliderModule } from 'ng2-nouislider';
import { Ng2GoogleChartsModule } from 'ng2-google-charts';
import {AngularOpenlayersModule} from 'ngx-openlayers';

import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

const appRoutes: Routes = [
  { path: '', component: DbAriaComponent },
  { path: 'aria', component: DbAriaComponent },
  { path: 'trips',      component: DbTripsComponent },
  { path: 'participation', component: DbParticipationComponent }
];

@NgModule({
  declarations: [
    AppComponent,
    NavComponent,
    DbAriaComponent,
    DbTripsComponent,
    DbParticipationComponent,
    FooterComponent
  ],
  imports: [
    BrowserModule,
    NouisliderModule,
    HttpClientModule,
    Ng2GoogleChartsModule,
    FormsModule,
    AngularOpenlayersModule,
    RouterModule.forRoot(
      appRoutes,
      { enableTracing: true } // <-- debugging purposes only
    )
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
