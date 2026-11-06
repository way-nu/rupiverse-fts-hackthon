"""RV4 acceptance · personal data never leaks: AC16.

Every profile flow runs with distinctive marker values; afterwards none of them may appear in the server log or in
any error body. (Valid genders are common words, so gender is checked through an invalid marker value instead.)
"""

import httpx

from tests.acceptance.conftest import Server
from tests.acceptance.rv4 import bearer, profile_user

NAME = "Zebulon Quixotic"
PHONE = "9182736450"
AGE = 87
BAD_NAME = "Quaxwellian" * 8  # 88 chars: too long
BAD_AGE = 7734
BAD_GENDER = "Xylophonegender"
BAD_PHONE = "+918273645"
TYPE_NAME = 31415926
TYPE_PHONE = 2718281828


async def test_ac16_profile_values_never_in_logs_or_error_bodies(server: Server, client: httpx.AsyncClient) -> None:
    """AC16: name, age, gender and phone never appear in backend logs or error bodies."""
    user = await profile_user(client)
    error_bodies: list[str] = []

    async def put(payload: object) -> httpx.Response:
        response = await user.put(payload)
        if response.status_code >= 400:
            error_bodies.append(response.text)
        return response

    valid = {"full_name": NAME, "age": AGE, "gender": "other", "phone": PHONE}
    assert (await put(valid)).status_code == 200
    assert (await user.get()).status_code == 200
    assert (await put({**valid, "full_name": f"  {NAME}  "})).status_code == 200
    assert (
        await put({"full_name": BAD_NAME, "age": BAD_AGE, "gender": BAD_GENDER, "phone": BAD_PHONE})
    ).status_code == 422
    assert (await put({**valid, "full_name": TYPE_NAME, "phone": TYPE_PHONE})).status_code == 422
    assert (await put({**valid, "age": f"{AGE}"})).status_code == 422
    assert (await put({**valid, "user_id": NAME})).status_code == 422
    assert (await put({"full_name": NAME, "phone": PHONE})).status_code == 422
    # 401 with a body full of personal data: the body must not be logged either.
    response = await client.put("/profile", json=valid, headers=bearer("not.a.jwt"))
    assert response.status_code == 401
    error_bodies.append(response.text)

    markers = [
        NAME,
        "Zebulon",
        "Quixotic",
        PHONE,
        BAD_NAME,
        str(BAD_AGE),
        BAD_GENDER,
        BAD_PHONE,
        "8273645",
        str(TYPE_NAME),
        str(TYPE_PHONE),
    ]
    in_bodies = sorted({m for m in markers for text in error_bodies if m in text})
    assert in_bodies == [], f"personal data echoed in error bodies: {in_bodies}"

    log = server.log_text()
    in_log = sorted(m for m in markers if m in log)
    assert in_log == [], f"personal data in the server log ({server.log_path}): {in_log}"
    assert f'"age": {AGE}' not in log and f"age={AGE}" not in log and f"'age': {AGE}" not in log
