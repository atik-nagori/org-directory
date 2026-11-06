import { Routes } from '@angular/router';
import { OrganisationList } from './features/organisations/organisation-list';

export const routes: Routes = [
  { path: '', component: OrganisationList },
  { path: '**', redirectTo: '' },
];