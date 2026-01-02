#!/usr/bin/env bun

import { ApiClient } from "../app/src/api/ApiClient.ts";

// curl -X PUT https://wiki.luckydye.de/api/v1/spaces/a6b43eab-d7fe-4656-b52d-dc1ac0db6deb/documents/73738c7b-cabe-4d21-8698-0e40cf8fb41b \
//     -H "Content-Type: application/json" \
//     -H "Authorization: Bearer at_c85d7d9c338a4a9d77de12096097af25be19a8900ca96b0562b75b7a696282ff" \
//     -d '{"content": "<html>Your content here</html>"}'

const api = new ApiClient({
  baseUrl: "http://127.0.0.1:4321",
  accessToken: "at_8797c0238342463f6e8de3a1280d0ca8c55e86f617fee6090dfe2aadf2fd6f2f"
});

const spaceId = "60a2dab1-3820-463d-8c63-2a804772810e";

console.log(await api.documents.get(spaceId));
