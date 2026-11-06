import { Routes } from '@angular/router';
import { OrganisationForm } from './features/organisations/organisation-form';
import { OrganisationList } from './features/organisations/organisation-list';

export const routes: Routes = [
  { path: '', component: OrganisationList },
  { path: 'new', component: OrganisationForm },
  { path: '**', redirectTo: '' },
];