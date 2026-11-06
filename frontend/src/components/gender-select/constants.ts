import type {Gender} from "@/services";

export const OPTIONS: { value: Gender; label: string }[] = [
    {value: "male", label: "Male"},
    {value: "female", label: "Female"},
    {value: "other", label: "Other"},
];

export const TEXT = {label: "Gender", optional: "optional"};
