import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DbParticipationComponent } from './db-participation.component';

describe('DbParticipationComponent', () => {
  let component: DbParticipationComponent;
  let fixture: ComponentFixture<DbParticipationComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DbParticipationComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DbParticipationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
