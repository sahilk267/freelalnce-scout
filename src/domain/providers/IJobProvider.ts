/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Job } from "../models/Job";

export interface IJobProvider {
  fetchJobs(): Promise<Job[]>;
}
