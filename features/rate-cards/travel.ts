import {z} from "zod";

export const travelFields=[
 {key:"tu_a_percent",short:"TU A",label:"Travel Uplift – Alex / North Coast / Ain Sokhna"},
 {key:"tu_b_percent",short:"TU B",label:"Travel Uplift – Red Sea / Sharm / Upper Egypt"},
 {key:"itu_percent",short:"ITU",label:"International Travel Uplift"},
] as const;
export const travelSchema=z.object({
 tu_a_percent:z.number().finite().min(0).max(10000).nullable().optional(),
 tu_b_percent:z.number().finite().min(0).max(10000).nullable().optional(),
 itu_percent:z.number().finite().min(0).max(10000).nullable().optional(),
});
export type TravelUplifts=z.infer<typeof travelSchema>;
