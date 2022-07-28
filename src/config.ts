'use strict';
/*
 *
 * SPDX-License-Identifier: Apache-2.0
 */
export default interface Config {
    input: string;
    output: string;
    template: string;
    templateDir: string;
    force: boolean;
}
