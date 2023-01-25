/*
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export type MapType = {
    [id: string]: string;
};

export interface Config {
    input: MapType;
    output: string;
    template: string;
    args: MapType;
    force: boolean;
}
