import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DbTripsComponent } from './db-trips.component';

describe('DbTripsComponent', () => {
  let component: DbTripsComponent;
  let fixture: ComponentFixture<DbTripsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DbTripsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DbTripsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
