import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DbAriaComponent } from './db-aria.component';

describe('DbAriaComponent', () => {
  let component: DbAriaComponent;
  let fixture: ComponentFixture<DbAriaComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DbAriaComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DbAriaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
