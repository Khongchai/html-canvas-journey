use core::panic;

use std::f64::consts::PI;

use wasm_bindgen::prelude::*;

// TODO : optimize by:
// adding things to vec in 1 instruction
// write to linear memory and have JavaScript read from it instead of copying over the values.

#[wasm_bindgen]
pub fn calc_lines(
    points: usize,
    mut theta: f64,
    step: f64,
    data: JsValue,
    rod_length: f64,
) -> Vec<f64> {
    let mut arr: Vec<f64> = Vec::with_capacity(points * 4);
    let mut first_time = true;
    let mut prev_point: [f64; 2] = [0.0, 0.0];
    let mut new_point: [f64; 2];
    // let mut prev_and_new_points: [f64; 4] = [];

    let parsed_data: Vec<Vec<f64>> = serde_wasm_bindgen::from_value(data).unwrap();

    // try pre-computing the first computation outside of the loop to get rid of the first if check
    // that gets run every iteration.
    for _ in 0..points {
        new_point = compute_epitrochoid(&parsed_data, theta, rod_length);

        if first_time {
            first_time = false;
        } else {
            arr.extend_from_slice(&[prev_point[0], prev_point[1], new_point[0], new_point[1]]);
        }

        prev_point = new_point;

        theta += step;
    }

    arr
}

pub fn compute_epitrochoid(data: &Vec<Vec<f64>>, theta: f64, rod_length: f64) -> [f64; 2] {
    if data.len() < 2 {
        panic!("Provide at least 2 cycloids");
    }

    let mut final_point = [0.0, 0.0];

    data.iter().for_each(|current_data| {
        final_point[0] += (current_data[0] + current_data[1])
            * (theta * current_data[3] - PI * 0.5 * current_data[2]).cos();
        final_point[1] += (current_data[0] + current_data[1])
            * (theta * current_data[3] + PI * 0.5 * current_data[2]).sin();
    });

    final_point[0] = final_point[0] + rod_length * theta.cos();
    final_point[1] = final_point[1] + rod_length * theta.sin();

    final_point
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Map, Value};
    use std::fs;

    #[test]
    fn compute_epitrochoid_test() {
        let data: String =
            fs::read_to_string("test_data.json").expect("Unable to read the test json file");
        let values: Value =
            serde_json::from_str(&data).expect("Unable to parse json into rust value");

        for value in values.as_array().unwrap() {
            let args: &Map<String, Value> = value["args"].as_object().unwrap();
            let theta: f64 = args["theta"].as_f64().unwrap();
            let rod_length: f64 = args["rodLength"].as_f64().unwrap();

            let data: Vec<Vec<f64>> = args["data"]
                .as_array()
                .unwrap()
                .iter()
                .map(|e| {
                    e.as_array()
                        .unwrap()
                        .iter()
                        .map(|e| e.as_f64().unwrap())
                        .collect::<Vec<f64>>()
                })
                .collect::<Vec<Vec<f64>>>();

            let computation_result = compute_epitrochoid(&data, theta, rod_length);
            let expected = value["result"].as_object().unwrap();

            println!("computation result: {:?}", computation_result);
            println!("expected: {:?}", expected);

            let bound = 0.0000001;

            assert_within_bound(
                computation_result[0],
                expected["x"].as_f64().unwrap(),
                bound,
            );

            assert_within_bound(
                computation_result[1],
                expected["y"].as_f64().unwrap(),
                bound,
            );
        }

        /// Assert that a given set of numbers's difference is no larger than some value.
        fn assert_within_bound(n1: f64, n2: f64, bound: f64) {
            return assert!((n1 - n2).abs() < bound);
        }
    }
}
