import {router} from "expo-router";
import {useCallback, useEffect, useState} from "react";

import {
    ageProblem,
    digitsOnly,
    isValidName,
    isValidPhone,
    PHONE_DIGITS,
    type ProfileField,
} from "@/hooks/use-validation";
import {api, ApiError, errorCode, type Gender, type ProfileOut, type ProfileUpdate} from "@/services";

import {AGE_MAX_LENGTH, PHONE_GROUP, SAVE_ERROR_TEXT, SAVE_FAILED_TEXT, TEXT} from "./constants";

type TextField = "name" | "age" | "phone";
type Values = { name: string; age: string; gender: Gender | null; phone: string };
type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; email: string };

const FIELD_OF: Record<TextField, ProfileField> = {name: "full_name", age: "age", phone: "phone"};
const NO_FLAGS: Record<TextField, boolean> = {name: false, age: false, phone: false};

// Phone is kept as digits; the space after the 5th digit is display only (design: "98765 43210").
export function formatPhone(digits: string): string {
    return digits.length > PHONE_GROUP ? `${digits.slice(0, PHONE_GROUP)} ${digits.slice(PHONE_GROUP)}` : digits;
}

export function valuesFrom(profile: ProfileOut): Values {
    return {
        name: profile.full_name ?? "",
        age: profile.age === null ? "" : String(profile.age),
        gender: profile.gender,
        phone: profile.phone ?? "",
    };
}

// The four §8 keys; an empty field is sent as null (clears it), phone as 10 digits with no spaces or +91.
export function toUpdate(values: Values): ProfileUpdate {
    const name = values.name.trim();
    return {
        full_name: name === "" ? null : name,
        age: values.age === "" ? null : Number(values.age),
        gender: values.gender,
        phone: values.phone === "" ? null : values.phone,
    };
}

// The design message for a field's current value, or null when it is valid (empty is always valid).
export function fieldError(field: TextField, values: Values): string | null {
    if (field === "name") {
        return isValidName(values.name) ? null : TEXT.nameShort;
    }
    if (field === "age") {
        const problem = ageProblem(values.age);
        return problem === "under" ? TEXT.ageUnder : problem === "invalid" ? TEXT.ageInvalid : null;
    }
    return isValidPhone(values.phone) ? null : TEXT.phoneInvalid;
}

type Fetched = { kind: "ready"; profile: ProfileOut } | { kind: "error" } | { kind: "signedOut" };

// A 401 has already ended the session (the signed-in layout sends the user to Login); anything else is the error state.
async function fetchProfile(): Promise<Fetched> {
    try {
        return {kind: "ready", profile: await api.profile.get()};
    } catch (caught) {
        return caught instanceof ApiError && caught.status === 401 ? {kind: "signedOut"} : {kind: "error"};
    }
}

// The message a server-highlighted field shows when its value passes the client rules.
const SERVER_TEXT: Record<TextField, string> = {name: TEXT.nameShort, age: TEXT.ageInvalid, phone: TEXT.phoneInvalid};

export function useProfile() {
    const [load, setLoad] = useState<Load>({kind: "loading"});
    const [values, setValues] = useState<Values>({name: "", age: "", gender: null, phone: ""});
    const [shown, setShown] = useState(NO_FLAGS);
    const [server, setServer] = useState(NO_FLAGS);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const apply = useCallback((result: Fetched) => {
        if (result.kind === "ready") {
            setValues(valuesFrom(result.profile));
            setShown(NO_FLAGS);
            setServer(NO_FLAGS);
            setLoad({kind: "ready", email: result.profile.email});
        } else if (result.kind === "error") {
            setLoad({kind: "error"});
        }
    }, []);

    useEffect(() => {
        let alive = true;
        fetchProfile().then((result) => alive && apply(result));
        return () => {
            alive = false;
        };
    }, [apply]);

    const retry = useCallback(async () => {
        setLoad({kind: "loading"});
        apply(await fetchProfile());
    }, [apply]);

    const errorFor = (field: TextField): string | null => {
        const client = shown[field] ? fieldError(field, values) : null;
        return client ?? (server[field] ? fieldError(field, values) ?? SERVER_TEXT[field] : null);
    };
    const errors = {name: errorFor("name"), age: errorFor("age"), phone: errorFor("phone")};
    const hasError = Object.values(errors).some(Boolean);

    function change(field: TextField, value: string) {
        setValues((current) => ({...current, [field]: value}));
        setServer((current) => ({...current, [field]: false}));
    }

    function blur(field: TextField) {
        setShown((current) => ({...current, [field]: true}));
    }

    async function save() {
        if (saving) {
            return;
        }
        setShown({name: true, age: true, phone: true});
        const invalid = (["name", "age", "phone"] as TextField[]).some((field) => fieldError(field, values));
        if (invalid) {
            return;
        }
        setSaving(true);
        setSaveError(null);
        try {
            await api.profile.update(toUpdate(values));
            router.replace("/home");
        } catch (caught) {
            const code = errorCode(caught);
            if (caught instanceof ApiError && caught.status === 401) {
                return; // session ended; the layout sends the user to Login
            }
            setSaveError(SAVE_ERROR_TEXT[code] ?? SAVE_FAILED_TEXT);
            if (code === "invalid_profile" && caught instanceof ApiError) {
                const listed = new Set(caught.extras.fields ?? []);
                setServer({
                    name: listed.has(FIELD_OF.name),
                    age: listed.has(FIELD_OF.age),
                    phone: listed.has(FIELD_OF.phone),
                });
            }
        } finally {
            setSaving(false);
        }
    }

    return {
        load,
        retry,
        name: values.name,
        age: values.age,
        gender: values.gender,
        phone: formatPhone(values.phone),
        errors,
        saveError,
        saving,
        canSave: !hasError,
        setName: (value: string) => change("name", value),
        setAge: (value: string) => change("age", digitsOnly(value).slice(0, AGE_MAX_LENGTH)),
        setPhone: (value: string) => change("phone", digitsOnly(value).slice(0, PHONE_DIGITS)),
        setGender: (value: Gender | null) => {
            setValues((current) => ({...current, gender: value}));
        },
        blurName: () => blur("name"),
        blurAge: () => blur("age"),
        blurPhone: () => blur("phone"),
        save,
        back: () => router.replace("/home"),
    };
}
