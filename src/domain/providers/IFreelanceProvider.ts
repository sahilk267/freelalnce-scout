/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FreelanceProject } from "../models/FreelanceProject";

export interface IFreelanceProvider {
  fetchFreelanceProjects(): Promise<FreelanceProject[]>;
}
