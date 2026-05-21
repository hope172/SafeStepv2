// ==========================================================================
// SAFESTEP V3 — MULTI-LOCATION REAL-TIME PERSONALIZED EVACUATION GUIDE
// ==========================================================================

// Chat states
const STATE_ALERT     = 0;
const STATE_CONDITION = 1;
const STATE_COMPANION = 2;
const STATE_TRANSPORT = 3;
const STATE_RESULTS   = 4;

let currentState    = STATE_ALERT;
let selectedDisaster = "flood";
let autoSimInterval  = null;  // Background auto-simulation ticker
let toastTimeout     = null;  // Toast dismiss timer

// User selections
const userProfile = {
    condition: null,  // child | adult | elderly | pregnant | disabled
    companion: null,  // alone | with_child | with_elderly | with_pet
    transport: null   // foot | car | wheelchair
};

// ★ v3: Active manual override flags
const activeOverrides = {
    flood_road:       false,
    station_collapse: false,
    obama_full:       false,
    kyunghee_full:    false
};

// ==========================================================================
// ★ v3: MULTI-LOCATION START POSITIONS DATABASE
// ==========================================================================
const LOCATIONS = {
    hufs_gate: {
        key: "hufs_gate",
        name: "한국외대 정문",
        short: "외대정문",
        x: 50, y: 60
    },
    kyunghee_gate: {
        key: "kyunghee_gate",
        name: "경희대 정문",
        short: "경희대정문",
        x: 14, y: 55
    },
    hufs_station: {
        key: "hufs_station",
        name: "외대앞역 1번출구",
        short: "외대앞역",
        x: 50, y: 88
    },
    imun_apt: {
        key: "imun_apt",
        name: "이문현대아파트",
        short: "이문현대아파트",
        x: 76, y: 24
    },
    cheonjang_park: {
        key: "cheonjang_park",
        name: "천장산 입구",
        short: "천장산입구",
        x: 10, y: 28
    },
    imun_market: {
        key: "imun_market",
        name: "이문시장 앞",
        short: "이문시장",
        x: 55, y: 72
    }
};

// Active user start location
let USER_LOCATION = { ...LOCATIONS.hufs_gate };

// ==========================================================================
// ★ v3: EXPANDED SHELTER DATABASE (6 shelters, 2 new)
// ==========================================================================
const SHELTER_DATABASE = [
    {
        id: 1,
        name: "한국외대 오바마홀",
        x: 45, y: 45,
        capacity: 500,
        occupancy: 280,
        facilities: ["wheelchair", "medical_center"],
        desc: "한국외대 서울캠퍼스 대형 실내체육시설. 내진 보강 설계 및 비상 임시 의료지원 구비.",
        routesByLocation: {
            hufs_gate: {
                flood:      { path: "M 50,60 L 45,45", blocked: "M 50,60 L 60,55 L 45,45", timeFoot:3, timeCar:1, timeWheelchair:5, instructions:"외대 정문에서 대학 본관을 경유해 오바마홀로 진입하는 최단 고지대 루트입니다.", warning:null },
                earthquake: { path: "M 50,60 L 45,45", blocked: "M 50,60 L 30,55 L 45,45", timeFoot:3, timeCar:1, timeWheelchair:5, instructions:"외대 본관 앞 개활지를 따라 오바마홀로 이동하십시오.", warning:null },
                wildfire:   { path: "M 50,60 L 45,45", blocked: "M 50,60 L 20,40 L 45,45", timeFoot:3, timeCar:1, timeWheelchair:5, instructions:"천장산 산불 저지선 동편 캠퍼스 중심가 도로를 경유하여 오바마홀로 진입하십시오.", warning:null },
                snow:       { path: "M 50,60 L 45,45", blocked: "M 50,60 L 40,30 L 45,45", timeFoot:4, timeCar:2, timeWheelchair:7, instructions:"외대 정문 평지 보도를 통해 서행 이동하십시오.", warning:null }
            },
            kyunghee_gate: {
                flood:      { path: "M 14,55 L 35,52 L 45,45", blocked: "M 14,55 L 25,70 L 45,45", timeFoot:10, timeCar:3, timeWheelchair:16, instructions:"경희대 정문에서 이문로 방면으로 이동 후 캠퍼스 서쪽 통로로 오바마홀에 접근하십시오.", warning:"경희대-외대 연결 구간 일부 침수 가능 — 포장 인도 이용." },
                earthquake: { path: "M 14,55 L 35,52 L 45,45", blocked: "M 14,55 L 45,45", timeFoot:9, timeCar:2, timeWheelchair:14, instructions:"경희대 정문에서 이문로 북편 보도를 통해 외대 캠퍼스 서문으로 진입하십시오.", warning:null },
                wildfire:   { path: "M 14,55 L 45,45", blocked: "M 14,55 L 5,40 L 45,45", timeFoot:8, timeCar:2, timeWheelchair:13, instructions:"천장산 저지선 남쪽 이문로 보도를 통해 외대 오바마홀로 이동하십시오.", warning:"산불 가스 확산 주의 — 서풍 불 때 마스크 착용." },
                snow:       { path: "M 14,55 L 35,52 L 45,45", blocked: "M 14,55 L 45,45", timeFoot:12, timeCar:4, timeWheelchair:19, instructions:"경희대 정문 앞 이면도로 빙판 주의. 이문로 대로변 포장 인도를 이용하십시오.", warning:"경사지 골목 결빙 낙상 다발." }
            },
            hufs_station: {
                flood:      { path: "M 50,88 L 50,70 L 45,45", blocked: "M 50,88 L 65,75 L 45,45", timeFoot:14, timeCar:3, timeWheelchair:20, instructions:"외대앞역 지하 지하차도는 침수 위험이 있습니다. 지상 출구(1번) 이용 후 이문로를 따라 북편 캠퍼스로 진입하십시오.", warning:"이문 지하차도 전면 침수 — 지하 이동 절대 금지." },
                earthquake: { path: "M 50,88 L 50,70 L 45,45", blocked: "M 50,88 L 45,45", timeFoot:12, timeCar:3, timeWheelchair:18, instructions:"외대앞역 삼거리 상업가 낙하물 우려. 이면도로 대신 넓은 이문로 보도를 이용하십시오.", warning:"외대앞역 앞 좁은 보도 낙하물 주의." },
                wildfire:   { path: "M 50,88 L 50,70 L 45,45", blocked: "M 50,88 L 35,70 L 45,45", timeFoot:11, timeCar:2, timeWheelchair:17, instructions:"산불 반대편인 동편 이문로 보도를 통해 북쪽 캠퍼스로 이동하십시오.", warning:null },
                snow:       { path: "M 50,88 L 50,70 L 45,45", blocked: "M 50,88 L 60,75 L 45,45", timeFoot:16, timeCar:4, timeWheelchair:24, instructions:"외대앞역 경사로 결빙 주의. 엘리베이터 출구 이용 후 대로변 이동.", warning:"역 출구 경사 램프 극심한 결빙." }
            },
            imun_apt: {
                flood:      { path: "M 76,24 L 60,35 L 45,45", blocked: "M 76,24 L 80,50 L 45,45", timeFoot:12, timeCar:3, timeWheelchair:18, instructions:"이문현대아파트에서 이문초등학교 동편 도로로 이동 후 외대 캠퍼스 북문으로 진입하십시오.", warning:null },
                earthquake: { path: "M 76,24 L 60,35 L 45,45", blocked: "M 76,24 L 45,45", timeFoot:11, timeCar:2, timeWheelchair:16, instructions:"아파트 단지 이면도로 낙하물 주의. 이문로 대로변 보도를 통해 외대 오바마홀로 이동하십시오.", warning:"주변 이면도로 노후 구조물 낙하 경보." },
                wildfire:   { path: "M 76,24 L 60,35 L 45,45", blocked: "M 76,24 L 45,45", timeFoot:10, timeCar:2, timeWheelchair:15, instructions:"천장산 산불에서 가장 멀리 위치. 이문로 남편을 따라 외대 캠퍼스 내 오바마홀 진입.", warning:null },
                snow:       { path: "M 76,24 L 60,35 L 45,45", blocked: "M 76,24 L 45,45", timeFoot:14, timeCar:4, timeWheelchair:21, instructions:"이문현대아파트 단지 내 경사로 빙판 주의. 단지 정문에서 이문로 보도로 나와 이동하십시오.", warning:"단지 내 경사로 결빙 심각." }
            },
            cheonjang_park: {
                flood:      { path: "M 10,28 L 28,40 L 45,45", blocked: "M 10,28 L 10,55 L 45,45", timeFoot:9, timeCar:2, timeWheelchair:14, instructions:"천장산 입구에서 이문로 방면으로 하산 후 외대 캠퍼스 서문으로 진입하십시오.", warning:null },
                earthquake: { path: "M 10,28 L 28,40 L 45,45", blocked: "M 10,28 L 45,45", timeFoot:8, timeCar:2, timeWheelchair:13, instructions:"산악지형 낙석 경보. 천장산 등산로를 피해 이문로 보도로 이동하십시오.", warning:"천장산 절개지 낙석 위험 — 즉시 산에서 내려오십시오." },
                wildfire:   { path: "M 10,28 L 45,28 L 45,45", blocked: "M 10,28 L 45,45", timeFoot:14, timeCar:4, timeWheelchair:22, instructions:"긴급: 천장산 산불 발화지 인근! 동쪽 이문로 방향으로 즉시 하산 후 오바마홀로 대피하십시오.", warning:"⚠️ 산불 발원지 인접! 신속히 동편으로 대피." },
                snow:       { path: "M 10,28 L 28,40 L 45,45", blocked: "M 10,28 L 45,45", timeFoot:14, timeCar:4, timeWheelchair:22, instructions:"천장산 산길 결빙 심각. 등산로 이탈 후 이문로 보도 경유 이동.", warning:"산길 전면 빙판 — 등산로 사용 금지." }
            },
            imun_market: {
                flood:      { path: "M 55,72 L 50,60 L 45,45", blocked: "M 55,72 L 65,65 L 45,45", timeFoot:8, timeCar:2, timeWheelchair:12, instructions:"이문시장 앞에서 이문로를 따라 북쪽 캠퍼스 방향으로 이동하십시오.", warning:null },
                earthquake: { path: "M 55,72 L 50,60 L 45,45", blocked: "M 55,72 L 45,45", timeFoot:7, timeCar:2, timeWheelchair:11, instructions:"이문시장 상가 낙하물 주의. 이문로 대로변 보도를 통해 이동하십시오.", warning:"시장 상가 건물 간판·외장재 낙하 경보." },
                wildfire:   { path: "M 55,72 L 50,60 L 45,45", blocked: "M 55,72 L 45,45", timeFoot:7, timeCar:2, timeWheelchair:11, instructions:"이문시장에서 이문로 북쪽 방면으로 이동, 외대 오바마홀로 진입하십시오.", warning:null },
                snow:       { path: "M 55,72 L 50,60 L 45,45", blocked: "M 55,72 L 45,45", timeFoot:10, timeCar:3, timeWheelchair:15, instructions:"이문시장 앞 이면도로 결빙. 이문로 대로변 포장 인도를 이용하십시오.", warning:"시장 골목길 결빙 낙상 주의." }
            }
        }
    },
    {
        id: 2,
        name: "이문초등학교 체육관",
        x: 70, y: 35,
        capacity: 300,
        occupancy: 288,
        facilities: ["wheelchair", "infant_care"],
        desc: "이문초등학교 실내 강당. 휠체어 램프 설치 완료. 현재 잔여 자리가 매우 협소합니다.",
        routesByLocation: {
            hufs_gate: {
                flood:      { path: "M 50,60 L 60,50 L 70,35", blocked: "M 50,60 L 70,55 L 70,35", timeFoot:10, timeCar:3, timeWheelchair:15, instructions:"중랑천 인근 도로 범람 위험. 정문 동편 이면도로를 통해 북동쪽 이문로28길 방향으로 우회하십시오.", warning:"중랑천 제방 경보 발령." },
                earthquake: { path: "M 50,60 L 70,35", blocked: "M 50,60 L 65,50 L 70,35", timeFoot:8, timeCar:2, timeWheelchair:12, instructions:"이문초등학교 방면 이면도로 낙하물 위험. 이문로 대로변 인도를 이용하십시오.", warning:"이면도로 낙하물(간판, 벽돌) 우려." },
                wildfire:   { path: "M 50,60 L 70,35", blocked: "M 50,60 L 30,50 L 70,35", timeFoot:8, timeCar:2, timeWheelchair:12, instructions:"산불 전파 반대편인 동부 주택가를 통과해 초등학교 강당에 도달하십시오.", warning:null },
                snow:       { path: "M 50,60 L 60,50 L 70,35", blocked: "M 50,60 L 65,40 L 70,35", timeFoot:12, timeCar:4, timeWheelchair:18, instructions:"이문고개 오르막 결빙 상태. 평지인 골목 초입을 거쳐 안전하게 통행하십시오.", warning:"이문고개 노면 극심한 결빙." }
            },
            kyunghee_gate: {
                flood:      { path: "M 14,55 L 50,45 L 70,35", blocked: "M 14,55 L 70,55 L 70,35", timeFoot:18, timeCar:5, timeWheelchair:27, instructions:"경희대 정문에서 이문로 북편 보도로 동쪽 방향 이동 후 이문초등학교로 진입하십시오.", warning:"이문로 동편 일부 구간 침수 우려." },
                earthquake: { path: "M 14,55 L 50,45 L 70,35", blocked: "M 14,55 L 70,35", timeFoot:16, timeCar:4, timeWheelchair:24, instructions:"경희대에서 이문로 보도를 따라 동쪽으로 이동, 이문초등학교 북문으로 진입하십시오.", warning:null },
                wildfire:   { path: "M 14,55 L 50,45 L 70,35", blocked: "M 14,55 L 70,35", timeFoot:15, timeCar:4, timeWheelchair:23, instructions:"천장산 산불에서 가장 먼 동쪽 방향. 이문로 보도 경유 안전 대피.", warning:null },
                snow:       { path: "M 14,55 L 50,45 L 70,35", blocked: "M 14,55 L 70,35", timeFoot:20, timeCar:6, timeWheelchair:30, instructions:"경희대에서 이문로 경유 장거리 이동. 대로변 포장 인도 이용 권장.", warning:"구간 길어 체력 관리 필요." }
            },
            hufs_station: {
                flood:      { path: "M 50,88 L 65,65 L 70,35", blocked: "M 50,88 L 80,65 L 70,35", timeFoot:15, timeCar:4, timeWheelchair:23, instructions:"외대앞역 지상 출구 이용 후 이문로 동편 도로를 따라 이문초등학교로 이동하십시오.", warning:"역 인근 지하차도 전면 침수." },
                earthquake: { path: "M 50,88 L 65,65 L 70,35", blocked: "M 50,88 L 70,35", timeFoot:13, timeCar:3, timeWheelchair:20, instructions:"외대앞역 삼거리 낙하물 경보. 이문로 보도를 이용해 북쪽 이문초등학교로 이동하십시오.", warning:"역 주변 상가 낙하물 주의." },
                wildfire:   { path: "M 50,88 L 65,65 L 70,35", blocked: "M 50,88 L 70,35", timeFoot:12, timeCar:3, timeWheelchair:18, instructions:"역 지상 출구 이용 후 이문로 동편 도로를 통해 이문초등학교로 이동하십시오.", warning:null },
                snow:       { path: "M 50,88 L 65,65 L 70,35", blocked: "M 50,88 L 70,35", timeFoot:17, timeCar:5, timeWheelchair:26, instructions:"역 출구 경사로 빙판 주의. 엘리베이터 출구 이용 후 이문로 보도 경유 이동.", warning:"역 경사 램프 결빙 극심." }
            },
            imun_apt: {
                flood:      { path: "M 76,24 L 70,35", blocked: "M 76,24 L 80,40 L 70,35", timeFoot:5, timeCar:1, timeWheelchair:8, instructions:"이문현대아파트에서 단지 남편 출입구를 통해 이문초등학교로 도보 이동하십시오.", warning:null },
                earthquake: { path: "M 76,24 L 70,35", blocked: "M 76,24 L 70,35", timeFoot:5, timeCar:1, timeWheelchair:8, instructions:"아파트 단지에서 가장 가까운 대피소. 단지 정문 이용 후 이문초등학교 북문으로 진입.", warning:null },
                wildfire:   { path: "M 76,24 L 70,35", blocked: "M 76,24 L 70,35", timeFoot:5, timeCar:1, timeWheelchair:8, instructions:"가장 인접한 대피소. 단지 남문으로 나와 이문초등학교로 이동하십시오.", warning:null },
                snow:       { path: "M 76,24 L 70,35", blocked: "M 76,24 L 70,35", timeFoot:7, timeCar:2, timeWheelchair:10, instructions:"아파트 단지 경사로 결빙. 단지 정문에서 이문로 보도 이용 후 이문초등학교로 이동.", warning:"단지 경사로 결빙." }
            },
            cheonjang_park: {
                flood:      { path: "M 10,28 L 45,25 L 70,35", blocked: "M 10,28 L 70,35", timeFoot:15, timeCar:4, timeWheelchair:23, instructions:"천장산 입구에서 북쪽 이문로를 따라 동편 이문초등학교로 이동하십시오.", warning:null },
                earthquake: { path: "M 10,28 L 45,25 L 70,35", blocked: "M 10,28 L 70,35", timeFoot:14, timeCar:3, timeWheelchair:21, instructions:"낙석 위험 산길 이탈 후 이문로 보도 경유 이문초등학교로 이동.", warning:"천장산 낙석 경보 — 즉시 하산." },
                wildfire:   { path: "M 10,28 L 45,25 L 70,35", blocked: "M 10,28 L 70,35", timeFoot:18, timeCar:5, timeWheelchair:27, instructions:"⚠️ 산불 발원지 인근! 동쪽 방향으로 즉시 이동, 이문초등학교로 대피하십시오.", warning:"산불 발원지 인접! 즉시 대피 필요." },
                snow:       { path: "M 10,28 L 45,25 L 70,35", blocked: "M 10,28 L 70,35", timeFoot:20, timeCar:6, timeWheelchair:30, instructions:"산길 결빙 — 이문로 보도 경유 이문초등학교로 이동. 장거리 이므로 체력 관리.", warning:"산길 전면 결빙." }
            },
            imun_market: {
                flood:      { path: "M 55,72 L 65,55 L 70,35", blocked: "M 55,72 L 75,60 L 70,35", timeFoot:11, timeCar:3, timeWheelchair:17, instructions:"이문시장에서 동편 이면도로를 따라 이문초등학교로 북쪽 이동하십시오.", warning:null },
                earthquake: { path: "M 55,72 L 65,55 L 70,35", blocked: "M 55,72 L 70,35", timeFoot:9, timeCar:2, timeWheelchair:14, instructions:"이문시장 상가 낙하물 주의. 이문로 동편 보도를 따라 이문초등학교로 이동.", warning:"시장 상가 낙하물 경보." },
                wildfire:   { path: "M 55,72 L 65,55 L 70,35", blocked: "M 55,72 L 70,35", timeFoot:9, timeCar:2, timeWheelchair:14, instructions:"이문시장에서 동편 이문로를 따라 북쪽 이문초등학교로 이동하십시오.", warning:null },
                snow:       { path: "M 55,72 L 65,55 L 70,35", blocked: "M 55,72 L 70,35", timeFoot:12, timeCar:3, timeWheelchair:18, instructions:"이문시장 이면도로 결빙. 이문로 대로변 보도를 이용하십시오.", warning:"이면도로 결빙 낙상 주의." }
            }
        }
    },
    {
        id: 3,
        name: "이문1동 주민센터",
        x: 25, y: 75,
        capacity: 200,
        occupancy: 88,
        facilities: ["pet_friendly", "infant_care"],
        desc: "이문로 안쪽 안전 주택가 내에 위치. 반려동물 임시 동행 구역 운영, 영유아 지원실 완비.",
        routesByLocation: {
            hufs_gate: {
                flood:      { path: "M 50,60 L 25,75", blocked: "M 50,60 L 50,85 L 25,75", timeFoot:9, timeCar:2, timeWheelchair:14, instructions:"남부 외대앞역 방향 지하차도가 침수 중. 외대정문 서쪽 골목길 주택가로 진입해 이동하십시오.", warning:"이문 지하차도 전면 통제." },
                earthquake: { path: "M 50,60 L 40,70 L 25,75", blocked: "M 50,60 L 25,75", timeFoot:12, timeCar:3, timeWheelchair:18, instructions:"외대 정문 서측 상업가 골목은 붕괴 잔해물이 많습니다. 주택가 정비 도로를 통해 이문파출소 방면으로 우회.", warning:"상가 구조물 파편 낙하 경보." },
                wildfire:   { path: "M 50,60 L 50,75 L 25,75", blocked: "M 50,60 L 25,75", timeFoot:15, timeCar:4, timeWheelchair:22, instructions:"주민센터 인근 천장산 산불 저지선 설치 중. 이문로 대로변 경유 남측 진입로로 접근하십시오.", warning:"천장산 인접 골목 산불 가스 위험." },
                snow:       { path: "M 50,60 L 25,75", blocked: "M 50,60 L 20,70 L 25,75", timeFoot:11, timeCar:3, timeWheelchair:16, instructions:"천장산 방면 비탈진 이면도로는 미끄럽습니다. 완만한 주택단지 사이 평지 도로를 통해 가십시오.", warning:"산비탈 경사 골목 결빙 낙상 다발." }
            },
            kyunghee_gate: {
                flood:      { path: "M 14,55 L 20,65 L 25,75", blocked: "M 14,55 L 25,75", timeFoot:7, timeCar:2, timeWheelchair:11, instructions:"경희대 정문에서 남쪽 주택가 도로를 따라 이문1동 주민센터로 이동하십시오.", warning:null },
                earthquake: { path: "M 14,55 L 20,65 L 25,75", blocked: "M 14,55 L 25,75", timeFoot:7, timeCar:2, timeWheelchair:11, instructions:"경희대 정문에서 가장 가까운 대피소. 남쪽 주택가 정비 도로를 통해 이동하십시오.", warning:null },
                wildfire:   { path: "M 14,55 L 20,65 L 25,75", blocked: "M 14,55 L 10,70 L 25,75", timeFoot:9, timeCar:3, timeWheelchair:14, instructions:"천장산 산불 인접 — 주민센터 방면 북쪽 골목 대신 이문로 대로변을 경유해 진입하십시오.", warning:"천장산 인근 골목 산불 위험." },
                snow:       { path: "M 14,55 L 20,65 L 25,75", blocked: "M 14,55 L 25,75", timeFoot:10, timeCar:3, timeWheelchair:15, instructions:"경희대에서 남쪽 주택가 평지 보도를 통해 이문1동 주민센터로 이동하십시오.", warning:null }
            },
            hufs_station: {
                flood:      { path: "M 50,88 L 35,80 L 25,75", blocked: "M 50,88 L 25,85 L 25,75", timeFoot:10, timeCar:3, timeWheelchair:15, instructions:"외대앞역 지상 출구 이용 후 서편 주택가 도로를 따라 이문1동 주민센터로 이동.", warning:"역 인근 지하차도 침수 — 지상 출구만 이용." },
                earthquake: { path: "M 50,88 L 35,80 L 25,75", blocked: "M 50,88 L 25,75", timeFoot:9, timeCar:2, timeWheelchair:13, instructions:"역 서편 주택가 도로를 통해 이문1동 주민센터로 이동하십시오.", warning:null },
                wildfire:   { path: "M 50,88 L 35,80 L 25,75", blocked: "M 50,88 L 25,75", timeFoot:9, timeCar:2, timeWheelchair:14, instructions:"외대앞역 지상 출구에서 서편 주택가 도로를 통해 이문1동 주민센터로 이동.", warning:null },
                snow:       { path: "M 50,88 L 35,80 L 25,75", blocked: "M 50,88 L 25,75", timeFoot:13, timeCar:4, timeWheelchair:20, instructions:"역 출구 경사로 빙판 주의. 지상 출구 이용 후 서편 주택가 이동.", warning:"역 경사로 결빙." }
            },
            imun_apt: {
                flood:      { path: "M 76,24 L 50,50 L 25,75", blocked: "M 76,24 L 25,75", timeFoot:20, timeCar:5, timeWheelchair:30, instructions:"이문현대아파트에서 이문로를 횡단 후 서편 주택가 도로를 통해 이문1동 주민센터로 이동하십시오.", warning:null },
                earthquake: { path: "M 76,24 L 50,50 L 25,75", blocked: "M 76,24 L 25,75", timeFoot:18, timeCar:4, timeWheelchair:27, instructions:"이문로 보도를 경유해 서편 이문1동 주민센터로 이동하십시오.", warning:null },
                wildfire:   { path: "M 76,24 L 50,50 L 25,75", blocked: "M 76,24 L 10,50 L 25,75", timeFoot:22, timeCar:6, timeWheelchair:33, instructions:"산불 반대편이나 이문1동 주민센터는 천장산 인접. 가능하면 다른 대피소를 검토하십시오.", warning:"천장산 인접 대피소 — 산불 시 주의." },
                snow:       { path: "M 76,24 L 50,50 L 25,75", blocked: "M 76,24 L 25,75", timeFoot:24, timeCar:7, timeWheelchair:36, instructions:"장거리 이동. 이문로 대로변 보도를 이용하십시오.", warning:"장거리 이동 시 체온 유지 주의." }
            },
            cheonjang_park: {
                flood:      { path: "M 10,28 L 15,50 L 25,75", blocked: "M 10,28 L 25,75", timeFoot:12, timeCar:3, timeWheelchair:18, instructions:"천장산 입구에서 산 인접 서편 도로를 따라 이문1동 주민센터로 이동하십시오.", warning:null },
                earthquake: { path: "M 10,28 L 15,50 L 25,75", blocked: "M 10,28 L 25,75", timeFoot:11, timeCar:3, timeWheelchair:17, instructions:"천장산 입구에서 낙석 구간을 피해 서편 도로를 통해 이문1동 주민센터로 이동.", warning:"낙석 구간 이탈 후 이동." },
                wildfire:   { path: "M 10,28 L 15,50 L 25,75", blocked: "M 10,28 L 25,75", timeFoot:16, timeCar:5, timeWheelchair:24, instructions:"⚠️ 위험: 천장산 입구와 이문1동 주민센터 모두 산불 인근. 즉시 동편 대피소로 변경하십시오.", warning:"⚠️ 산불 위험구역 인근 대피소!" },
                snow:       { path: "M 10,28 L 15,50 L 25,75", blocked: "M 10,28 L 25,75", timeFoot:15, timeCar:4, timeWheelchair:23, instructions:"천장산 등산로 결빙 — 서편 포장 도로로 하산 후 이문1동 주민센터로 이동.", warning:"산길 결빙." }
            },
            imun_market: {
                flood:      { path: "M 55,72 L 40,72 L 25,75", blocked: "M 55,72 L 25,75", timeFoot:8, timeCar:2, timeWheelchair:12, instructions:"이문시장에서 서편 주택가 도로를 따라 이문1동 주민센터로 이동하십시오.", warning:null },
                earthquake: { path: "M 55,72 L 40,72 L 25,75", blocked: "M 55,72 L 25,75", timeFoot:7, timeCar:2, timeWheelchair:11, instructions:"시장 서편 주택가 골목을 통해 이문1동 주민센터로 이동하십시오.", warning:null },
                wildfire:   { path: "M 55,72 L 40,72 L 25,75", blocked: "M 55,72 L 25,75", timeFoot:8, timeCar:2, timeWheelchair:12, instructions:"이문시장에서 서편 주택가 도로를 경유 이문1동 주민센터로 이동하십시오.", warning:null },
                snow:       { path: "M 55,72 L 40,72 L 25,75", blocked: "M 55,72 L 25,75", timeFoot:11, timeCar:3, timeWheelchair:17, instructions:"이문시장 골목 결빙. 포장 대로변을 통해 서편 이문1동 주민센터로 이동하십시오.", warning:"골목 결빙 낙상 주의." }
            }
        }
    },
    {
        id: 4,
        name: "이문동 쌍용아파트 지하대피소",
        x: 75, y: 80,
        capacity: 400,
        occupancy: 160,
        facilities: ["wheelchair", "pet_friendly"],
        desc: "튼튼한 콘크리트 철골조 지하 주차장에 조성된 정부 지정 민방위 대피소.",
        routesByLocation: {
            hufs_gate: {
                flood:      { path: "M 50,60 L 75,80", blocked: "M 50,60 L 50,85 L 75,80", timeFoot:999, timeCar:999, timeWheelchair:999, instructions:"경고: 호우 침수 시 지하주차장은 역류 침수 위험이 대단히 높으므로 진입이 불가합니다.", warning:"지하 주차장 입구 차수막 작동 중. 침수 상황 시 진입 절대 차단." },
                earthquake: { path: "M 50,60 L 65,60 L 75,80", blocked: "M 50,60 L 50,85 L 75,80", timeFoot:8, timeCar:2, timeWheelchair:12, instructions:"외대앞역 삼거리 낙하물 구역을 우회해 쌍용아파트 주 출입구 비상 계단으로 대피하십시오.", warning:"외대앞역 앞 좁은 보도 낙하물 우려." },
                wildfire:   { path: "M 50,60 L 75,80", blocked: "M 50,60 L 35,70 L 75,80", timeFoot:7, timeCar:2, timeWheelchair:10, instructions:"천장산 산불에서 가장 먼 동남쪽 콘크리트 지하 대피 구역.", warning:null },
                snow:       { path: "M 50,60 L 75,80", blocked: "M 50,60 L 65,70 L 75,80", timeFoot:10, timeCar:3, timeWheelchair:15, instructions:"이문 지하차도 인근 물고임 결빙 도로를 우회해 아파트 상가 사거리 안길로 이동하십시오.", warning:"지하주차장 진출입 경사 램프 미끄럼 주의." }
            },
            kyunghee_gate: {
                flood:      { path: "M 14,55 L 75,80", blocked: "M 14,55 L 75,80", timeFoot:999, timeCar:999, timeWheelchair:999, instructions:"침수 시 지하 대피소 절대 금지. 다른 대피소를 선택하십시오.", warning:"지하 대피소 침수 위험 — 진입 불가." },
                earthquake: { path: "M 14,55 L 50,65 L 75,80", blocked: "M 14,55 L 75,80", timeFoot:18, timeCar:5, timeWheelchair:27, instructions:"경희대에서 이문로 남편 보도를 따라 쌍용아파트로 이동하십시오.", warning:null },
                wildfire:   { path: "M 14,55 L 50,65 L 75,80", blocked: "M 14,55 L 75,80", timeFoot:16, timeCar:4, timeWheelchair:24, instructions:"경희대에서 이문로 남편 보도를 따라 동편 쌍용아파트로 이동하십시오.", warning:null },
                snow:       { path: "M 14,55 L 50,65 L 75,80", blocked: "M 14,55 L 75,80", timeFoot:22, timeCar:6, timeWheelchair:33, instructions:"경희대에서 장거리 이동. 이문로 대로변 보도 이용.", warning:"장거리 이동 시 체온 유지." }
            },
            hufs_station: {
                flood:      { path: "M 50,88 L 75,80", blocked: "M 50,88 L 75,80", timeFoot:999, timeCar:999, timeWheelchair:999, instructions:"침수 시 지하 대피소 진입 절대 금지.", warning:"지하 대피소 침수 위험." },
                earthquake: { path: "M 50,88 L 65,85 L 75,80", blocked: "M 50,88 L 75,80", timeFoot:7, timeCar:2, timeWheelchair:10, instructions:"외대앞역에서 동쪽 방향 이동 후 쌍용아파트로 진입하십시오.", warning:null },
                wildfire:   { path: "M 50,88 L 65,85 L 75,80", blocked: "M 50,88 L 75,80", timeFoot:6, timeCar:1, timeWheelchair:9, instructions:"역 동편 출구에서 쌍용아파트 지하 대피소로 이동하십시오.", warning:null },
                snow:       { path: "M 50,88 L 65,85 L 75,80", blocked: "M 50,88 L 75,80", timeFoot:9, timeCar:2, timeWheelchair:13, instructions:"역 출구 경사로 빙판 주의 후 동편 쌍용아파트로 이동.", warning:"역 경사 램프 결빙." }
            },
            imun_apt: {
                flood:      { path: "M 76,24 L 75,80", blocked: "M 76,24 L 75,80", timeFoot:999, timeCar:999, timeWheelchair:999, instructions:"침수 시 지하 대피소 절대 진입 금지.", warning:"지하 대피소 침수 위험." },
                earthquake: { path: "M 76,24 L 75,60 L 75,80", blocked: "M 76,24 L 75,80", timeFoot:9, timeCar:2, timeWheelchair:13, instructions:"이문현대아파트에서 남쪽으로 이동해 쌍용아파트 지하 대피소로 진입하십시오.", warning:null },
                wildfire:   { path: "M 76,24 L 75,60 L 75,80", blocked: "M 76,24 L 75,80", timeFoot:9, timeCar:2, timeWheelchair:13, instructions:"이문현대아파트에서 남쪽 이동 후 쌍용아파트로 진입하십시오.", warning:null },
                snow:       { path: "M 76,24 L 75,60 L 75,80", blocked: "M 76,24 L 75,80", timeFoot:11, timeCar:3, timeWheelchair:17, instructions:"이문현대아파트 경사로 결빙 주의 후 남쪽 이동.", warning:"단지 경사로 결빙." }
            },
            cheonjang_park: {
                flood:      { path: "M 10,28 L 75,80", blocked: "M 10,28 L 75,80", timeFoot:999, timeCar:999, timeWheelchair:999, instructions:"침수 시 지하 대피소 절대 금지.", warning:"지하 대피소 침수 위험." },
                earthquake: { path: "M 10,28 L 50,55 L 75,80", blocked: "M 10,28 L 75,80", timeFoot:22, timeCar:6, timeWheelchair:33, instructions:"천장산 입구에서 이문로 경유 장거리 이동. 낙석 구간 이탈 후 보도 이동.", warning:"낙석 구간 이탈." },
                wildfire:   { path: "M 10,28 L 50,55 L 75,80", blocked: "M 10,28 L 75,80", timeFoot:22, timeCar:6, timeWheelchair:33, instructions:"천장산 입구에서 동편으로 즉시 대피 후 이문로 경유 쌍용아파트로 이동.", warning:"산불 발원지 인접 — 즉시 이동." },
                snow:       { path: "M 10,28 L 50,55 L 75,80", blocked: "M 10,28 L 75,80", timeFoot:28, timeCar:8, timeWheelchair:42, instructions:"장거리 이동. 산길 결빙으로 이문로 보도 경유 이동.", warning:"장거리 이동 체온 유지." }
            },
            imun_market: {
                flood:      { path: "M 55,72 L 75,80", blocked: "M 55,72 L 75,80", timeFoot:999, timeCar:999, timeWheelchair:999, instructions:"침수 시 지하 대피소 절대 금지.", warning:"지하 대피소 침수 위험." },
                earthquake: { path: "M 55,72 L 65,75 L 75,80", blocked: "M 55,72 L 75,80", timeFoot:6, timeCar:1, timeWheelchair:9, instructions:"이문시장에서 동편 도로를 따라 쌍용아파트 지하 대피소로 이동하십시오.", warning:null },
                wildfire:   { path: "M 55,72 L 65,75 L 75,80", blocked: "M 55,72 L 75,80", timeFoot:6, timeCar:1, timeWheelchair:9, instructions:"이문시장에서 동편 쌍용아파트 지하 대피소로 이동하십시오.", warning:null },
                snow:       { path: "M 55,72 L 65,75 L 75,80", blocked: "M 55,72 L 75,80", timeFoot:9, timeCar:2, timeWheelchair:14, instructions:"이문시장 골목 결빙. 이문로 보도를 이용해 쌍용아파트로 이동하십시오.", warning:"골목 결빙." }
            }
        }
    },
    {
        id: 5,
        name: "경희대학교 평화의전당",
        x: 10, y: 48,
        capacity: 800,
        occupancy: 320,
        facilities: ["wheelchair", "medical_center", "infant_care"],
        desc: "경희대학교 평화의전당 — 대형 내진 공연장 대피소. 의료진 상주, 영유아실 완비.",
        routesByLocation: {
            hufs_gate: {
                flood:      { path: "M 50,60 L 28,55 L 10,48", blocked: "M 50,60 L 10,48", timeFoot:16, timeCar:4, timeWheelchair:24, instructions:"외대 정문에서 서쪽 이문로를 따라 경희대 방면으로 이동하십시오. 도로 침수 주의.", warning:null },
                earthquake: { path: "M 50,60 L 28,55 L 10,48", blocked: "M 50,60 L 10,48", timeFoot:14, timeCar:3, timeWheelchair:21, instructions:"외대 정문에서 서편 이문로 보도를 통해 경희대 평화의전당으로 이동하십시오.", warning:null },
                wildfire:   { path: "M 50,60 L 28,55 L 10,48", blocked: "M 50,60 L 10,30 L 10,48", timeFoot:16, timeCar:4, timeWheelchair:24, instructions:"천장산 산불 저지선 남편을 따라 경희대 평화의전당으로 이동하십시오.", warning:"천장산 인접 이면도로 산불 가스 주의." },
                snow:       { path: "M 50,60 L 28,55 L 10,48", blocked: "M 50,60 L 10,48", timeFoot:20, timeCar:5, timeWheelchair:30, instructions:"외대 정문에서 서편 이문로 보도를 통해 경희대 평화의전당으로 이동하십시오.", warning:"경사 구간 결빙 주의." }
            },
            kyunghee_gate: {
                flood:      { path: "M 14,55 L 10,48", blocked: "M 14,55 L 10,48", timeFoot:3, timeCar:1, timeWheelchair:5, instructions:"경희대 정문에서 가장 가까운 대피소. 캠퍼스 정문 진입 후 평화의전당으로 이동하십시오.", warning:null },
                earthquake: { path: "M 14,55 L 10,48", blocked: "M 14,55 L 10,48", timeFoot:3, timeCar:1, timeWheelchair:5, instructions:"경희대 정문에서 바로 경내로 진입, 평화의전당으로 대피하십시오. 내진 최우수 시설.", warning:null },
                wildfire:   { path: "M 14,55 L 10,48", blocked: "M 14,55 L 5,40 L 10,48", timeFoot:4, timeCar:1, timeWheelchair:6, instructions:"경희대 정문에서 경내 진입 — 천장산 인접이나 건물 내부는 안전합니다.", warning:"천장산 인접 — 야외 이동 최소화." },
                snow:       { path: "M 14,55 L 10,48", blocked: "M 14,55 L 10,48", timeFoot:4, timeCar:1, timeWheelchair:6, instructions:"경희대 정문에서 가장 가까운 대피소. 캠퍼스 내 포장 도로 이용.", warning:null }
            },
            hufs_station: {
                flood:      { path: "M 50,88 L 28,70 L 10,48", blocked: "M 50,88 L 10,48", timeFoot:20, timeCar:5, timeWheelchair:30, instructions:"외대앞역 지상 출구 이용 후 서편 도로를 따라 경희대 평화의전당으로 이동하십시오.", warning:"역 주변 침수 — 지상 이동만 이용." },
                earthquake: { path: "M 50,88 L 28,70 L 10,48", blocked: "M 50,88 L 10,48", timeFoot:18, timeCar:4, timeWheelchair:27, instructions:"역 지상 출구 이용 후 서편 도로 경유 경희대 평화의전당으로 이동하십시오.", warning:null },
                wildfire:   { path: "M 50,88 L 28,70 L 10,48", blocked: "M 50,88 L 10,48", timeFoot:18, timeCar:4, timeWheelchair:27, instructions:"역 지상 출구 이용 후 서편 도로 경유 경희대 평화의전당으로 이동하십시오.", warning:null },
                snow:       { path: "M 50,88 L 28,70 L 10,48", blocked: "M 50,88 L 10,48", timeFoot:24, timeCar:6, timeWheelchair:36, instructions:"역 출구 경사로 빙판 주의. 지상 이동 후 서편 도로 경유 경희대로 이동.", warning:"역 경사로 결빙." }
            },
            imun_apt: {
                flood:      { path: "M 76,24 L 45,35 L 10,48", blocked: "M 76,24 L 10,48", timeFoot:28, timeCar:7, timeWheelchair:42, instructions:"이문현대아파트에서 장거리 이동. 이문로 북편 보도를 통해 서쪽 경희대 방면으로 이동하십시오.", warning:null },
                earthquake: { path: "M 76,24 L 45,35 L 10,48", blocked: "M 76,24 L 10,48", timeFoot:25, timeCar:6, timeWheelchair:38, instructions:"이문로 보도 경유 서편 경희대 평화의전당으로 이동하십시오.", warning:null },
                wildfire:   { path: "M 76,24 L 45,35 L 10,48", blocked: "M 76,24 L 10,48", timeFoot:25, timeCar:6, timeWheelchair:38, instructions:"이문현대아파트에서 이문로 보도 경유 서편 경희대로 이동하십시오.", warning:null },
                snow:       { path: "M 76,24 L 45,35 L 10,48", blocked: "M 76,24 L 10,48", timeFoot:32, timeCar:9, timeWheelchair:48, instructions:"장거리 이동. 이문로 대로변 보도 이용. 체온 유지 필수.", warning:"장거리 이동 체온 유지." }
            },
            cheonjang_park: {
                flood:      { path: "M 10,28 L 10,48", blocked: "M 10,28 L 10,48", timeFoot:6, timeCar:1, timeWheelchair:9, instructions:"천장산 입구에서 남쪽 방향 내리막 도로를 따라 경희대 평화의전당으로 이동하십시오.", warning:null },
                earthquake: { path: "M 10,28 L 10,48", blocked: "M 10,28 L 10,48", timeFoot:6, timeCar:1, timeWheelchair:9, instructions:"천장산 입구에서 가장 가까운 대피소. 낙석 구간 피해 내리막 도로로 이동.", warning:"천장산 낙석 구간 이탈 필수." },
                wildfire:   { path: "M 10,28 L 10,48", blocked: "M 10,28 L 5,40 L 10,48", timeFoot:8, timeCar:2, timeWheelchair:12, instructions:"천장산 산불 위험 — 즉시 하산하여 경희대 평화의전당 건물 내부로 대피하십시오.", warning:"⚠️ 산불 인근 — 건물 내 대피." },
                snow:       { path: "M 10,28 L 10,48", blocked: "M 10,28 L 10,48", timeFoot:9, timeCar:2, timeWheelchair:14, instructions:"천장산 등산로 결빙. 서편 포장 도로로 하산 후 경희대로 이동.", warning:"산길 결빙." }
            },
            imun_market: {
                flood:      { path: "M 55,72 L 30,65 L 10,48", blocked: "M 55,72 L 10,48", timeFoot:17, timeCar:4, timeWheelchair:26, instructions:"이문시장에서 서편 도로를 따라 경희대 평화의전당으로 이동하십시오.", warning:null },
                earthquake: { path: "M 55,72 L 30,65 L 10,48", blocked: "M 55,72 L 10,48", timeFoot:15, timeCar:4, timeWheelchair:23, instructions:"이문시장 상가 낙하물 주의. 이문로 서편 보도 이용해 경희대로 이동.", warning:"시장 상가 낙하물 주의." },
                wildfire:   { path: "M 55,72 L 30,65 L 10,48", blocked: "M 55,72 L 10,48", timeFoot:15, timeCar:4, timeWheelchair:23, instructions:"이문시장에서 서편 보도를 통해 경희대 평화의전당으로 이동하십시오.", warning:null },
                snow:       { path: "M 55,72 L 30,65 L 10,48", blocked: "M 55,72 L 10,48", timeFoot:20, timeCar:5, timeWheelchair:30, instructions:"이문시장 골목 결빙. 이문로 보도 경유 서편 경희대로 이동하십시오.", warning:"이문로 골목 결빙." }
            }
        }
    },
    {
        id: 6,
        name: "이문동 삼익아파트 지하대피소",
        x: 80, y: 50,
        capacity: 350,
        occupancy: 140,
        facilities: ["wheelchair", "pet_friendly"],
        desc: "이문동 동편 삼익아파트 단지 민방위 지하대피소. 반려동물 허용, 휠체어 경사로 완비.",
        routesByLocation: {
            hufs_gate: {
                flood:      { path: "M 50,60 L 80,50", blocked: "M 50,60 L 80,50", timeFoot:999, timeCar:999, timeWheelchair:999, instructions:"침수 시 지하 대피소 절대 진입 금지.", warning:"지하 대피소 침수 위험." },
                earthquake: { path: "M 50,60 L 65,55 L 80,50", blocked: "M 50,60 L 80,50", timeFoot:9, timeCar:2, timeWheelchair:13, instructions:"외대 정문에서 동쪽 이문로를 따라 삼익아파트로 이동하십시오.", warning:null },
                wildfire:   { path: "M 50,60 L 65,55 L 80,50", blocked: "M 50,60 L 80,50", timeFoot:9, timeCar:2, timeWheelchair:13, instructions:"천장산 산불 반대편 동쪽 삼익아파트 지하 대피소로 이동하십시오.", warning:null },
                snow:       { path: "M 50,60 L 65,55 L 80,50", blocked: "M 50,60 L 80,50", timeFoot:12, timeCar:3, timeWheelchair:18, instructions:"외대 정문에서 동편 이문로 보도를 통해 삼익아파트로 이동하십시오.", warning:"동편 이문로 부분 결빙." }
            },
            kyunghee_gate: {
                flood:      { path: "M 14,55 L 80,50", blocked: "M 14,55 L 80,50", timeFoot:999, timeCar:999, timeWheelchair:999, instructions:"침수 시 지하 대피소 절대 금지.", warning:"지하 대피소 침수 위험." },
                earthquake: { path: "M 14,55 L 50,52 L 80,50", blocked: "M 14,55 L 80,50", timeFoot:20, timeCar:5, timeWheelchair:30, instructions:"경희대 정문에서 이문로 보도를 따라 동쪽 삼익아파트로 이동하십시오.", warning:null },
                wildfire:   { path: "M 14,55 L 50,52 L 80,50", blocked: "M 14,55 L 80,50", timeFoot:20, timeCar:5, timeWheelchair:30, instructions:"경희대에서 이문로 동편 보도를 따라 삼익아파트로 이동하십시오.", warning:null },
                snow:       { path: "M 14,55 L 50,52 L 80,50", blocked: "M 14,55 L 80,50", timeFoot:26, timeCar:7, timeWheelchair:39, instructions:"경희대에서 이문로 보도 경유 장거리 이동. 체온 유지.", warning:"장거리 이동." }
            },
            hufs_station: {
                flood:      { path: "M 50,88 L 80,50", blocked: "M 50,88 L 80,50", timeFoot:999, timeCar:999, timeWheelchair:999, instructions:"침수 시 지하 대피소 절대 금지.", warning:"침수 위험." },
                earthquake: { path: "M 50,88 L 65,70 L 80,50", blocked: "M 50,88 L 80,50", timeFoot:12, timeCar:3, timeWheelchair:18, instructions:"외대앞역 지상 출구 이용 후 동편 삼익아파트로 이동하십시오.", warning:null },
                wildfire:   { path: "M 50,88 L 65,70 L 80,50", blocked: "M 50,88 L 80,50", timeFoot:12, timeCar:3, timeWheelchair:18, instructions:"역 지상 출구 이용 후 동편 삼익아파트 지하 대피소로 이동하십시오.", warning:null },
                snow:       { path: "M 50,88 L 65,70 L 80,50", blocked: "M 50,88 L 80,50", timeFoot:15, timeCar:4, timeWheelchair:23, instructions:"역 경사로 결빙 주의. 지상 출구 이용 후 동편 삼익아파트로 이동.", warning:"역 경사로 결빙." }
            },
            imun_apt: {
                flood:      { path: "M 76,24 L 80,50", blocked: "M 76,24 L 80,50", timeFoot:999, timeCar:999, timeWheelchair:999, instructions:"침수 시 지하 대피소 절대 금지.", warning:"침수 위험." },
                earthquake: { path: "M 76,24 L 78,37 L 80,50", blocked: "M 76,24 L 80,50", timeFoot:6, timeCar:1, timeWheelchair:9, instructions:"이문현대아파트에서 가장 가까운 민방위 대피소. 남쪽으로 이동해 삼익아파트로 진입.", warning:null },
                wildfire:   { path: "M 76,24 L 78,37 L 80,50", blocked: "M 76,24 L 80,50", timeFoot:6, timeCar:1, timeWheelchair:9, instructions:"이문현대아파트에서 남쪽 삼익아파트 지하 대피소로 이동하십시오.", warning:null },
                snow:       { path: "M 76,24 L 78,37 L 80,50", blocked: "M 76,24 L 80,50", timeFoot:9, timeCar:2, timeWheelchair:14, instructions:"이문현대아파트 경사로 결빙 주의 후 남쪽 삼익아파트로 이동.", warning:"경사로 결빙." }
            },
            cheonjang_park: {
                flood:      { path: "M 10,28 L 80,50", blocked: "M 10,28 L 80,50", timeFoot:999, timeCar:999, timeWheelchair:999, instructions:"침수 시 지하 대피소 절대 금지.", warning:"침수 위험." },
                earthquake: { path: "M 10,28 L 50,38 L 80,50", blocked: "M 10,28 L 80,50", timeFoot:22, timeCar:6, timeWheelchair:33, instructions:"천장산 입구에서 이문로 보도 경유 장거리 동편 삼익아파트로 이동하십시오.", warning:"낙석 구간 이탈 필수." },
                wildfire:   { path: "M 10,28 L 50,38 L 80,50", blocked: "M 10,28 L 80,50", timeFoot:22, timeCar:6, timeWheelchair:33, instructions:"천장산 산불 발원지 인접 — 즉시 동편으로 이동, 삼익아파트 지하로 대피하십시오.", warning:"⚠️ 즉시 동편 대피." },
                snow:       { path: "M 10,28 L 50,38 L 80,50", blocked: "M 10,28 L 80,50", timeFoot:28, timeCar:8, timeWheelchair:42, instructions:"산길 결빙 — 이문로 보도 경유 장거리 이동.", warning:"장거리 이동 체온 유지." }
            },
            imun_market: {
                flood:      { path: "M 55,72 L 80,50", blocked: "M 55,72 L 80,50", timeFoot:999, timeCar:999, timeWheelchair:999, instructions:"침수 시 지하 대피소 절대 금지.", warning:"침수 위험." },
                earthquake: { path: "M 55,72 L 68,61 L 80,50", blocked: "M 55,72 L 80,50", timeFoot:8, timeCar:2, timeWheelchair:12, instructions:"이문시장에서 동편 도로를 따라 삼익아파트로 이동하십시오.", warning:null },
                wildfire:   { path: "M 55,72 L 68,61 L 80,50", blocked: "M 55,72 L 80,50", timeFoot:8, timeCar:2, timeWheelchair:12, instructions:"이문시장에서 동편 삼익아파트 지하 대피소로 이동하십시오.", warning:null },
                snow:       { path: "M 55,72 L 68,61 L 80,50", blocked: "M 55,72 L 80,50", timeFoot:11, timeCar:3, timeWheelchair:17, instructions:"이문시장 골목 결빙. 이문로 보도를 통해 동편 삼익아파트로 이동.", warning:"골목 결빙." }
            }
        }
    }
];

// Danger Zones per Disaster Type
const DANGER_ZONES = {
    flood:      [ { name: "중랑천 수위 위험 구역", x:85, y:45, r:15 }, { name: "이문 지하차도 전면 침수", x:50, y:85, r:10 } ],
    earthquake: [ { name: "천장산 절개지 낙석", x:15, y:25, r:12 }, { name: "외대앞역 상가 붕괴위험", x:50, y:85, r:12 } ],
    wildfire:   [ { name: "천장산 산불 확산 지역", x:12, y:30, r:22 } ],
    snow:       [ { name: "천장산 이면길 결빙", x:25, y:42, r:12 }, { name: "이문고개 언덕 결빙", x:65, y:65, r:10 } ]
};

// Disaster presets
const DISASTER_PRESETS = {
    flood: {
        badgeText: "긴급 호우・침수 경보",
        mainTitle: "집중호우 및 이문동·회기동 도로 침수",
        mainDesc: "현재 중랑천 인근 범람 수위 도달 및 이문 지하차도가 전면 침수 통제되었습니다. 고지대 대피소로 긴급 이동하십시오.",
        weatherTitle: "현재 강수 상태",
        weatherVal: "폭우 (120mm/h)",
        blockTitle: "통제 도로 구역",
        blockVal: "이문 지하차도, 중랑천",
        tips: [ "침수된 도로나 지하차도는 차량 절대 진입 금지", "가로등·전신주·지하층 전기 차단기 접촉 금지 (감전 예방)", "계단 물흐름 발생 시 신속히 최상층 또는 고지대로 이동" ]
    },
    earthquake: {
        badgeText: "긴급 지진 재난 경보",
        mainTitle: "규모 5.8 강진 발생 (여진 우려)",
        mainDesc: "지진동으로 인해 건물 유리창 파손 및 외대앞역 노후 상가 낙하물 사고가 빈번합니다. 내진 설계 완료 대피소로 가십시오.",
        weatherTitle: "진도 등급",
        weatherVal: "진도 VI (강한 진동)",
        blockTitle: "위험 차단선",
        blockVal: "노후 골목상가, 산비탈 낙석",
        tips: [ "가방이나 손으로 머리를 보호하고 낙하물(간판, 외벽) 경계", "엘리베이터 사용 전면 금지, 건물 계단 복도를 통한 신속 대피", "지진동 정지 시 낙석 우려되는 천장산 사면 접근 절대 피함" ]
    },
    wildfire: {
        badgeText: "긴급 산불 대피 통보",
        mainTitle: "천장산 대형 산불 급속 확산 중",
        mainDesc: "천장산 사면에서 발화한 불길이 서풍을 타고 외대 캠퍼스 서측 민가 구역으로 확산되고 있습니다. 동남편 대피소로 즉시 대피하십시오.",
        weatherTitle: "풍향 및 풍속",
        weatherVal: "서풍 (8.5m/s, 건조)",
        blockTitle: "진화 작업선",
        blockVal: "천장산 인접 이면도로",
        tips: [ "문과 창문을 닫아 외부 불씨 차단하고 가스 밸브 잠그기", "대피 시 물에 적신 수건으로 코와 입을 가려 질식 가스 방지", "바람 방향을 확인하여 불길 반대편(동쪽/남쪽 대로)으로 즉시 피난" ]
    },
    snow: {
        badgeText: "대설 재해 및 한파 경보",
        mainTitle: "기습 대설에 따른 급경사 결빙 경보",
        mainDesc: "이문동·회기동 일대에 20cm 이상의 폭설과 영하 12도 한파로 고개길 및 주택가 비탈길 노면이 빙판입니다. 안심 경로로 통행하십시오.",
        weatherTitle: "적설량 및 기온",
        weatherVal: "신적설 22cm / -12.4℃",
        blockTitle: "결빙 위험 지대",
        blockVal: "천장산 사면 경사지, 이문고개",
        tips: [ "노약자, 임산부는 주택 비탈 골목길을 피하고 대로변 포장길로 이동", "주머니에 손을 넣지 말고 아이젠 등 미끄럼 방지 용품 활용", "차량 이동 시 경사 램프 구간 정체 예상되므로 도보 이동 권장" ]
    }
};

// Chat questions
const CHAT_QUESTIONS = {
    [STATE_CONDITION]: {
        botMsg: "안녕하세요. SafeStep 실시간 대피 도우미입니다. 신속한 대피 경로 분석을 위해 대피 대상자의 <strong>특성 및 연령대</strong>를 선택해 주세요.",
        options: [
            { value: "child",    text: "아동 (13세 미만)",       icon: "👶" },
            { value: "adult",    text: "일반 성인 (14~59세)",    icon: "🧑" },
            { value: "elderly",  text: "고령자 (60세 이상)",     icon: "👵" },
            { value: "pregnant", text: "임산부",                icon: "🤰" },
            { value: "disabled", text: "장애인 / 교통약자",      icon: "👩‍🦽" }
        ]
    },
    [STATE_COMPANION]: {
        botMsg: "현재 안전 확보가 시급합니다. 대피를 함께 하시는 <strong>동행인 여부</strong>를 탭해 주세요.",
        options: [
            { value: "alone",        text: "혼자 대피함",   icon: "🙋‍♂️" },
            { value: "with_child",   text: "아동 동반",     icon: "👩‍👦" },
            { value: "with_elderly", text: "노약자 동반",   icon: "🧑‍🦽" },
            { value: "with_pet",     text: "반려동물 동반", icon: "🐶" }
        ]
    },
    [STATE_TRANSPORT]: {
        botMsg: "현재 가용할 수 있는 <strong>이동 수단</strong>은 무엇입니까?",
        options: [
            { value: "foot",        text: "도보 대피 이동",      icon: "🚶" },
            { value: "car",         text: "차량 이동",           icon: "🚗" },
            { value: "wheelchair",  text: "휠체어 / 보행 보조기", icon: "👨‍🦽" }
        ]
    }
};

let selectedShelterId = null;

// ==========================================================================
// HELPER: Get route for current location + shelter + disaster
// ==========================================================================
function getRouteData(shelter, disasterType) {
    const locKey = USER_LOCATION.key || "hufs_gate";
    const byLoc  = shelter.routesByLocation[locKey];
    if (!byLoc) return null;
    return byLoc[disasterType] || null;
}

// ==========================================================================
// AI RANKING ALGORITHM (v3 — aware of start location & overrides)
// ==========================================================================
function calculateRecommendations() {
    // Simulate small live fluctuations in occupancy
    SHELTER_DATABASE.forEach(s => {
        const shift = Math.floor(Math.random() * 7) - 3;
        s.occupancy = Math.max(10, Math.min(s.capacity, s.occupancy + shift));
    });

    // Apply overrides
    if (activeOverrides.obama_full) {
        const obama = SHELTER_DATABASE.find(s => s.id === 1);
        if (obama) obama.occupancy = obama.capacity;
    }
    if (activeOverrides.kyunghee_full) {
        const kyunghee = SHELTER_DATABASE.find(s => s.id === 5);
        if (kyunghee) kyunghee.occupancy = kyunghee.capacity;
    }

    const scored = SHELTER_DATABASE.map(shelter => {
        let score = 100;

        // 1. Proximity from current USER_LOCATION
        const dx = shelter.x - USER_LOCATION.x;
        const dy = shelter.y - USER_LOCATION.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        score -= distance * 0.9;

        // 2. Crowd penalty
        const occ = shelter.occupancy / shelter.capacity;
        if (occ >= 0.98)      score -= 100;
        else if (occ >= 0.85) score -= 35;
        else if (occ >= 0.60) score -= 12;
        else if (occ <  0.45) score += 15;

        // 3. Disaster-specific rules
        const matchDetails = [];

        if (selectedDisaster === "flood") {
            if (shelter.id === 4 || shelter.id === 6) { score -= 120; matchDetails.push("지하 대피소: 침수 위험 (-120)"); }
            if (shelter.id === 2)                     { score -= 25;  matchDetails.push("하천 인접 감점 (-25)"); }
            if (shelter.id === 1 || shelter.id === 3 || shelter.id === 5) { score += 15; matchDetails.push("고지대 안전지대 (+15)"); }
        } else if (selectedDisaster === "earthquake") {
            if (shelter.id === 1)                     { score += 25; matchDetails.push("내진 우수 가점 (+25)"); }
            if (shelter.id === 5)                     { score += 30; matchDetails.push("내진 최우수 가점 (+30)"); }
            if (shelter.id === 4 || shelter.id === 6) { score += 20; matchDetails.push("철골 지하 지탱 가점 (+20)"); }
            if (shelter.id === 3)                     { score -= 20; matchDetails.push("산사태 우려지 감점 (-20)"); }
        } else if (selectedDisaster === "wildfire") {
            if (shelter.id === 3)                     { score -= 110; matchDetails.push("산불 경로 대피소 (-110)"); }
            if (shelter.id === 5)                     { score -= 30;  matchDetails.push("천장산 인접 감점 (-30)"); }
            if (shelter.id === 2 || shelter.id === 4 || shelter.id === 6) { score += 20; matchDetails.push("동부 안심구역 (+20)"); }
        } else if (selectedDisaster === "snow") {
            if (shelter.id === 1 || shelter.id === 3 || shelter.id === 5) { score += 15; matchDetails.push("실내 난방 완비 (+15)"); }
            if (shelter.id === 4 || shelter.id === 6) { score -= 20; matchDetails.push("빙판 램프 감점 (-20)"); }
        }

        // 4. Demographic boosts
        if (userProfile.condition === "disabled") {
            shelter.facilities.includes("wheelchair") ? (score += 50) : (score -= 60);
        }
        if (userProfile.condition === "pregnant") {
            if (shelter.facilities.includes("medical_center")) score += 30;
            if (shelter.facilities.includes("infant_care"))    score += 20;
        }
        if (userProfile.condition === "elderly") {
            if (shelter.facilities.includes("medical_center")) score += 25;
            if (shelter.facilities.includes("wheelchair"))     score += 15;
        }
        if (userProfile.condition === "child") {
            if (shelter.facilities.includes("infant_care"))    score += 25;
        }

        // 5. Companion boosts
        if (userProfile.companion === "with_pet") {
            shelter.facilities.includes("pet_friendly") ? (score += 40) : (score -= 30);
        }
        if (userProfile.companion === "with_elderly" && shelter.facilities.includes("medical_center")) score += 20;
        if (userProfile.companion === "with_child"   && shelter.facilities.includes("infant_care"))    score += 20;

        const finalScore = Math.max(0, Math.round(score));
        const routeData  = getRouteData(shelter, selectedDisaster);
        const isUnusable = routeData && (routeData.timeFoot === 999);

        return {
            ...shelter,
            distance:    Math.round(distance * 11),
            occupancyRate: Math.round(occ * 100),
            finalScore,
            matchDetails,
            isUnusable
        };
    });

    return scored.sort((a, b) => b.finalScore - a.finalScore).slice(0, 3);
}

// ==========================================================================
// SCREEN FLOW CONTROLLER
// ==========================================================================
function changeScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(screenId).classList.add("active");

    if (screenId === "screen-alert") {
        currentState = STATE_ALERT;
        userProfile.condition = null;
        userProfile.companion = null;
        userProfile.transport = null;
        selectedShelterId = null;
        document.getElementById("chat-feed").innerHTML = "";
    }
}

function startChatbot() {
    // If localStorage has profile, pre-fill
    const saved = loadProfile();
    if (saved) {
        userProfile.condition = saved.condition;
        userProfile.companion = saved.companion;
        userProfile.transport = saved.transport;
    }
    changeScreen("screen-chat");
    currentState = STATE_CONDITION;
    updateProgressTracker();
    renderChatStep();
}

function updateProgressTracker() {
    document.getElementById("indicator-age").className       = "step-indicator";
    document.getElementById("indicator-companion").className = "step-indicator";
    document.getElementById("indicator-transport").className = "step-indicator";
    const lines = document.querySelectorAll(".step-line");
    lines[0].className = "step-line";
    lines[1].className = "step-line";

    if (currentState >= STATE_CONDITION) document.getElementById("indicator-age").classList.add("active");
    if (currentState >= STATE_COMPANION) {
        document.getElementById("indicator-age").className = "step-indicator complete";
        document.getElementById("indicator-companion").classList.add("active");
        lines[0].classList.add("active");
    }
    if (currentState >= STATE_TRANSPORT) {
        document.getElementById("indicator-companion").className = "step-indicator complete";
        document.getElementById("indicator-transport").classList.add("active");
        lines[1].classList.add("active");
    }
}

function renderChatStep() {
    const feed  = document.getElementById("chat-feed");
    const panel = document.getElementById("action-panel");
    panel.innerHTML = "";

    const stepData = CHAT_QUESTIONS[currentState];
    if (!stepData) return;

    const botBubble = document.createElement("div");
    botBubble.className = "bubble bot";
    botBubble.innerHTML = stepData.botMsg;
    feed.appendChild(botBubble);
    scrollChatBottom();

    stepData.options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "btn-option";
        // Pre-select if saved
        const savedVal = userProfile[currentState === STATE_CONDITION ? "condition" : currentState === STATE_COMPANION ? "companion" : "transport"];
        if (savedVal === opt.value) btn.style.borderColor = "var(--info-blue)";

        btn.innerHTML = `
            <span class="option-label">
                <span class="option-icon">${opt.icon}</span>
                <span>${opt.text}</span>
            </span>
            <span class="option-arrow">➔</span>
        `;
        btn.addEventListener("click", () => handleUserSelection(opt.value, opt.text));
        panel.appendChild(btn);
    });
}

function handleUserSelection(value, labelText) {
    const feed = document.getElementById("chat-feed");

    const userBubble = document.createElement("div");
    userBubble.className = "bubble user";
    userBubble.innerText = labelText;
    feed.appendChild(userBubble);
    scrollChatBottom();

    if (currentState === STATE_CONDITION) {
        userProfile.condition = value;
        currentState = STATE_COMPANION;
        setTimeout(() => { updateProgressTracker(); renderChatStep(); }, 400);
    } else if (currentState === STATE_COMPANION) {
        userProfile.companion = value;
        currentState = STATE_TRANSPORT;
        setTimeout(() => { updateProgressTracker(); renderChatStep(); }, 400);
    } else if (currentState === STATE_TRANSPORT) {
        userProfile.transport = value;
        saveProfile();

        const calcBubble = document.createElement("div");
        calcBubble.className = "bubble bot";
        calcBubble.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="logo-pulse"></span>
                <span>대피 경로 침수 상태 및 대피소 혼잡도를 매칭 분석하고 있습니다. 잠시만 대피 자세를 유지하십시오...</span>
            </div>
        `;
        feed.appendChild(calcBubble);
        scrollChatBottom();

        setTimeout(showRecommendations, 1200);
    }
}

function scrollChatBottom() {
    const feed = document.getElementById("chat-feed");
    feed.scrollTop = feed.scrollHeight;
}

// ==========================================================================
// RESULTS DASHBOARD
// ==========================================================================
function showRecommendations() {
    changeScreen("screen-results");

    const conditionTexts = { child:"🧒 아동 (13세 미만)", adult:"🧑 일반 성인", elderly:"👵 고령자", pregnant:"🤰 임산부", disabled:"♿ 장애인/교통약자" };
    const companionTexts = { alone:"🙋‍♂️ 1인 대피", with_child:"👶 아동 동반", with_elderly:"👵 노약자 동반", with_pet:"🐶 반려동물 동반" };
    const transportTexts = { foot:"🚶 도보 대피", car:"🚗 차량 대피", wheelchair:"👩‍🦽 휠체어/보행기" };

    document.getElementById("summary-condition").innerText = `대상: ${conditionTexts[userProfile.condition] || ""}`;
    document.getElementById("summary-companion").innerText = `동행: ${companionTexts[userProfile.companion] || ""}`;
    document.getElementById("summary-transport").innerText = `이동: ${transportTexts[userProfile.transport] || ""}`;
    document.getElementById("summary-location").innerText  = `📍 ${USER_LOCATION.short || USER_LOCATION.name}`;

    const recommendations = calculateRecommendations();
    selectedShelterId = recommendations[0].id;

    const listContainer = document.getElementById("shelter-list");
    listContainer.innerHTML = "";

    const facilityIcons = {
        wheelchair:    "♿ 휠체어 램프",
        medical_center:"🏥 임시 의료진",
        pet_friendly:  "🐾 반려동물 수용",
        infant_care:   "🍼 영유아실"
    };

    recommendations.forEach((shelter, idx) => {
        const isSelected = shelter.id === selectedShelterId;
        const rankNum    = idx + 1;

        const facilityTagsHTML = shelter.facilities.map(fac => {
            const req =
                (fac === "wheelchair"    && (userProfile.transport === "wheelchair" || userProfile.condition === "disabled")) ||
                (fac === "pet_friendly"  && userProfile.companion === "with_pet") ||
                (fac === "infant_care"   && (userProfile.companion === "with_child" || userProfile.condition === "child" || userProfile.condition === "pregnant")) ||
                (fac === "medical_center"&& (userProfile.companion === "with_elderly" || userProfile.condition === "elderly" || userProfile.condition === "pregnant"));
            return `<span class="facility-tag ${req ? 'highlight' : ''}">${facilityIcons[fac] || fac}</span>`;
        }).join("");

        let barColorClass = "bar-green";
        let crowdText = "여유";
        if      (shelter.occupancyRate >= 85) { barColorClass = "bar-red";    crowdText = "혼잡 (만원 직전)"; }
        else if (shelter.occupancyRate >= 55) { barColorClass = "bar-orange"; crowdText = "보통"; }

        const card = document.createElement("div");
        card.className = `shelter-card ${isSelected ? 'selected' : ''} ${shelter.isUnusable ? 'shelter-unusable' : ''}`;
        card.setAttribute("data-id", shelter.id);
        card.innerHTML = `
            <div class="shelter-card-header">
                <span class="shelter-rank-tag rank-${rankNum}">${shelter.isUnusable ? '대피 불가' : rankNum + '순위 추천'}</span>
                <span class="shelter-match-score" style="${shelter.isUnusable ? 'color:var(--primary-red); background:rgba(239,68,68,0.1);':''}">
                    ${shelter.isUnusable ? '위험 등급' : shelter.finalScore + '점 적합'}
                </span>
            </div>
            <h3 class="shelter-name" style="${shelter.isUnusable ? 'color:var(--text-muted); text-decoration:line-through;':''}">${shelter.name}</h3>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">${shelter.desc}</p>

            ${shelter.isUnusable ? `
                <div style="font-size:0.85rem; color:var(--primary-red); font-weight:bold; margin-top:8px;">
                    ⚠️ 지하 대피구역 침수 봉쇄로 절대 진입 금지 대상입니다.
                </div>
            ` : `
                <div class="shelter-stats">
                    <div class="stat-item"><span>거리:</span><span class="stat-value-bold">${shelter.distance}m</span></div>
                    <div class="stat-item"><span>총 정원:</span><span class="stat-value-bold">${shelter.capacity}인</span></div>
                </div>
                <div class="occupancy-section">
                    <div class="occupancy-header">
                        <span>실시간 수용도 (${crowdText})</span>
                        <span>${shelter.occupancy} / ${shelter.capacity} 명 (${shelter.occupancyRate}%)</span>
                    </div>
                    <div class="occupancy-bar-bg">
                        <div class="occupancy-bar-fill ${barColorClass}" style="width:${shelter.occupancyRate}%"></div>
                    </div>
                </div>
                <div class="facility-tags">${facilityTagsHTML}</div>
            `}
        `;

        if (!shelter.isUnusable) {
            card.addEventListener("click", () => selectShelter(shelter.id));
        }
        listContainer.appendChild(card);
    });

    renderSVGMap(recommendations);
    updateRouteDetails(selectedShelterId);
}

function selectShelter(shelterId) {
    selectedShelterId = shelterId;
    document.querySelectorAll(".shelter-card").forEach(card => {
        card.classList.toggle("selected", parseInt(card.getAttribute("data-id")) === shelterId);
    });
    updateMapSelectedRoute(shelterId);
    updateRouteDetails(shelterId);
}

// ==========================================================================
// SVG MAP RENDERING (v3 — dynamic user location pin)
// ==========================================================================
function renderSVGMap(recommendedShelters) {
    const mapWrapper   = document.getElementById("svg-map-wrapper");
    const activeHazards = DANGER_ZONES[selectedDisaster] || [];
    const ux = USER_LOCATION.x;
    const uy = USER_LOCATION.y;

    // Extra dynamic hazard if override active
    const extraHazards = [];
    if (activeOverrides.flood_road)       extraHazards.push({ name: "이문로 긴급 침수 발생", x:50, y:60, r:12 });
    if (activeOverrides.station_collapse) extraHazards.push({ name: "외대앞역 붕괴 위험", x:50, y:88, r:14 });
    const allHazards = [...activeHazards, ...extraHazards];

    let svgContent = `
        <svg viewBox="0 0 100 100" class="svg-map" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="hazard-stripe" width="5" height="5" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="5" stroke="#ef4444" stroke-width="2" />
                </pattern>
                <filter id="route-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            <!-- Background grid -->
            <g class="map-grid">
                ${Array.from({length:9}, (_,i) => `<line x1="${(i+1)*10}" y1="0" x2="${(i+1)*10}" y2="100" />`).join("")}
                ${Array.from({length:9}, (_,i) => `<line x1="0" y1="${(i+1)*10}" x2="100" y2="${(i+1)*10}" />`).join("")}
            </g>

            <!-- Mountain Cheonjangsan -->
            <path d="M 0,0 L 25,0 L 20,20 L 5,35 L 0,40 Z" fill="#1e3a1e" opacity="0.45" />
            <text x="5" y="14" class="landmark-label">천장산 산림지대</text>

            <!-- River Jungnangcheon -->
            <path d="M 85,0 Q 92,30 83,60 T 95,100 L 100,100 L 100,0 Z" class="map-water" />
            <text x="93" y="22" class="water-label" transform="rotate(75,93,22)" font-size="2">중랑천</text>

            <!-- Roads -->
            <g>
                <line x1="50" y1="0" x2="50" y2="100" class="map-road-bg" />
                <path d="M 50,60 L 45,45 M 45,45 L 25,45 M 25,45 L 25,75 M 50,60 L 25,75" class="map-road-bg" />
                <path d="M 50,60 L 70,60 L 70,35 M 70,35 L 85,35" class="map-road-bg" />
                <path d="M 50,88 L 75,88 L 75,80" class="map-road-bg" />
                <path d="M 50,60 L 50,88" class="map-road-bg" />
                <path d="M 14,55 L 50,52" class="map-road-bg" />
                <path d="M 10,28 L 45,35" class="map-road-bg" />
                <line x1="50" y1="0" x2="50" y2="100" class="map-road" />
                <path d="M 50,60 L 45,45 M 45,45 L 25,45 M 25,45 L 25,75 M 50,60 L 25,75" class="map-road" />
                <path d="M 50,60 L 70,60 L 70,35 M 70,35 L 85,35" class="map-road" />
                <path d="M 50,88 L 75,88 L 75,80" class="map-road" />
                <path d="M 50,60 L 50,88" class="map-road" />
                <path d="M 14,55 L 50,52" class="map-road" />
            </g>

            <text x="52" y="8" class="landmark-label" font-size="1.8" letter-spacing="0.2">← 이문로 대로 →</text>
            <text x="53" y="93" class="landmark-label" font-size="2">외대앞역 삼거리</text>
            <text x="30" y="55" class="landmark-label" font-size="1.8">외대캠퍼스 뒷길</text>
            <text x="71" y="58" class="landmark-label" font-size="1.8">이문주택가</text>

            <!-- Danger Zones -->
            <g id="map-hazard-zones">
                ${allHazards.map(z => `
                    <circle cx="${z.x}" cy="${z.y}" r="${z.r}" class="map-hazard-zone" />
                    <circle cx="${z.x}" cy="${z.y}" r="2" class="hazard-marker-glow" />
                    <circle cx="${z.x}" cy="${z.y}" r="0.8" class="hazard-marker" />
                    <text x="${z.x}" y="${z.y - z.r - 1.5}" fill="#ef4444" font-size="2" font-weight="900" text-anchor="middle">${z.name}</text>
                `).join("")}
            </g>

            <!-- Dynamic Routes Group -->
            <g id="map-dynamic-routes"></g>

            <!-- Shelter Pins -->
            <g id="map-shelter-pins">
                ${SHELTER_DATABASE.map(s => {
                    const isRec      = recommendedShelters.some(r => r.id === s.id);
                    const recIndex   = recommendedShelters.findIndex(r => r.id === s.id) + 1;
                    const occ        = s.occupancy / s.capacity;
                    let pinSize = 2.5, pinColor = "#4b5563";
                    const rd = getRouteData(s, selectedDisaster);
                    const isUnusable = rd && rd.timeFoot === 999;

                    if (isRec && !isUnusable) {
                        if      (occ >= 0.85) { pinSize = 6.5; pinColor = "#ef4444"; }
                        else if (occ >= 0.50) { pinSize = 4.5; pinColor = "#f59e0b"; }
                        else                   { pinSize = 3.5; pinColor = "#10b981"; }
                    }
                    if (isUnusable) { pinColor = "#1e293b"; pinSize = 2.5; }

                    return `
                        <g class="node-shelter-g" id="pin-shelter-${s.id}">
                            <circle cx="${s.x}" cy="${s.y}" r="${pinSize}" fill="${pinColor}"
                                class="node-shelter ${(isRec && occ >= 0.85) ? 'node-shelter-crowded' : ''}"
                                onclick="selectShelter(${s.id})" />
                            ${isRec && !isUnusable ? `<text x="${s.x}" y="${s.y+0.8}" fill="white" font-size="2.6" font-weight="900" text-anchor="middle" pointer-events="none">${recIndex}</text>` : ''}
                            ${isUnusable ? `<text x="${s.x}" y="${s.y+0.8}" fill="#ef4444" font-size="2.2" font-weight="900" text-anchor="middle">X</text>` : ''}
                            <text x="${s.x}" y="${s.y - pinSize - 1.2}" fill="${isRec ? '#f8fafc' : '#64748b'}" font-size="2.2" font-weight="bold" text-anchor="middle">${s.name}</text>
                        </g>
                    `;
                }).join("")}
            </g>

            <!-- User Location Pin -->
            <g id="map-user-pin">
                <circle cx="${ux}" cy="${uy}" r="5.5" class="node-user-pulse" />
                <circle cx="${ux}" cy="${uy}" r="2.5" class="node-user" />
                <text x="${ux}" y="${uy+5.5}" fill="#3b82f6" font-size="2.4" font-weight="bold" text-anchor="middle">📍 ${USER_LOCATION.short || '내 위치'}</text>
            </g>
        </svg>
    `;

    mapWrapper.innerHTML = svgContent;
    updateMapSelectedRoute(selectedShelterId);
}

function updateMapSelectedRoute(shelterId) {
    const routeGroup = document.getElementById("map-dynamic-routes");
    if (!routeGroup) return;

    const shelter = SHELTER_DATABASE.find(s => s.id === shelterId);
    if (!shelter) return;

    const routeData = getRouteData(shelter, selectedDisaster);
    if (!routeData) return;

    if (routeData.blocked && routeData.blocked !== "") {
        routeGroup.innerHTML = `
            <path d="${routeData.blocked}" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1.5 2.5" opacity="0.8" />
            <path d="${routeData.path}" class="map-route-glow" />
            <path d="${routeData.path}" class="map-route" />
        `;
    } else {
        routeGroup.innerHTML = `
            <path d="${routeData.path}" class="map-route-glow" />
            <path d="${routeData.path}" class="map-route" />
        `;
    }

    document.querySelectorAll(".node-shelter").forEach(el => el.classList.remove("node-shelter-selected"));
    const activeCircle = document.querySelector(`#pin-shelter-${shelterId} circle`);
    if (activeCircle) activeCircle.classList.add("node-shelter-selected");
}

function updateRouteDetails(shelterId) {
    const shelter = SHELTER_DATABASE.find(s => s.id === shelterId);
    if (!shelter) return;

    const routeData = getRouteData(shelter, selectedDisaster);
    if (!routeData) return;

    let speedFactor = 1.0, speedLabel = "도보 대피";
    if      (userProfile.condition === "disabled")  { speedFactor = 2.0; speedLabel = "교통약자 도보 (속도 지연)"; }
    else if (userProfile.condition === "pregnant")   { speedFactor = 1.6; speedLabel = "임산부 서행 대피"; }
    else if (userProfile.condition === "elderly")    { speedFactor = 1.5; speedLabel = "고령자 대피 서행"; }
    else if (userProfile.condition === "child")      { speedFactor = 1.3; speedLabel = "아동 보행 서행"; }

    let minutes = routeData.timeFoot;
    if      (userProfile.transport === "car")        { minutes = routeData.timeCar;                                             speedLabel = "차량 긴급 피난"; }
    else if (userProfile.transport === "wheelchair") { minutes = Math.round(routeData.timeWheelchair * (userProfile.condition === "disabled" ? 1.2 : 1.0)); speedLabel = "휠체어/보행 보조기"; }
    else                                             { minutes = Math.round(minutes * speedFactor); }

    const isUnusable = routeData.timeFoot === 999;
    document.getElementById("route-est-time").innerText = isUnusable
        ? "⚠️ 이 대피소는 현재 재난 상황에서 접근 불가입니다."
        : `예상 대피 시간: 약 ${minutes}분 (${speedLabel})`;

    document.getElementById("route-instructions").innerHTML = `
        <p style="font-weight:700; margin-bottom:4px; color:var(--text-main);">안전한 이동 경로 안내 (출발: ${USER_LOCATION.name}):</p>
        <p>${routeData.instructions}</p>
    `;

    const alertDiv = document.getElementById("route-safety-alert");
    if (routeData.warning) {
        alertDiv.className = "route-safety-alert visible";
        alertDiv.innerHTML = `<span style="font-size:1.1rem;">⚠️</span><span><strong>위험 지대 근접 알림:</strong> ${routeData.warning}</span>`;
    } else {
        alertDiv.className = "route-safety-alert";
    }
}

// ==========================================================================
// ★ v3: REAL-TIME TOAST ALERT
// ==========================================================================
function showToast(title, msg) {
    const toast = document.getElementById("realtime-toast");
    document.getElementById("toast-title").innerText = title;
    document.getElementById("toast-msg").innerText   = msg;

    // Reset animation
    toast.classList.remove("show");
    void toast.offsetWidth; // reflow
    toast.classList.add("show");

    // Restart progress bar
    const bar = document.getElementById("toast-progress-bar");
    bar.style.animation = "none";
    void bar.offsetWidth;
    bar.style.animation = "toast-drain 5s linear forwards";

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 5200);
}

// ==========================================================================
// ★ v3: CONTROL CENTER — MANUAL TRIGGERS
// ==========================================================================
function applyOverride(action) {
    const statusDot  = document.getElementById("control-live-status").querySelector(".status-dot");
    const statusText = document.getElementById("status-text");

    if (action === "reset") {
        Object.keys(activeOverrides).forEach(k => activeOverrides[k] = false);
        document.querySelectorAll(".ctrl-btn").forEach(b => b.classList.remove("active"));
        statusDot.className  = "status-dot status-ok";
        statusText.innerText = "초기화 완료 — 상태 정상";
        if (currentState === STATE_RESULTS) refreshResultsDynamic();
        return;
    }

    activeOverrides[action] = !activeOverrides[action];
    const btn = document.querySelector(`[data-action="${action}"]`);
    if (btn) btn.classList.toggle("active", activeOverrides[action]);

    const messages = {
        flood_road:       ["⚠️ 이문로 침수 발생", "이문로 도로 침수 감지! 경로 실시간 재분석 중..."],
        station_collapse: ["⚠️ 외대앞역 붕괴 경보", "외대앞역 인근 구조물 붕괴 위험! 대피 경로 우회 중..."],
        obama_full:       ["🚫 오바마홀 정원 초과", "한국외대 오바마홀 수용 한계 도달! 다음 대피소로 변경 중..."],
        kyunghee_full:    ["🚫 경희대 평화의전당 정원 초과", "경희대 평화의전당 수용 한계! 대안 대피소 재탐색 중..."]
    };

    if (activeOverrides[action]) {
        statusDot.className  = "status-dot status-active";
        statusText.innerText = `${messages[action][0]} 이벤트 활성화`;
        showToast(messages[action][0], messages[action][1]);
    } else {
        statusDot.className  = "status-dot status-ok";
        statusText.innerText = "이벤트 해제 — 상태 재분석";
    }

    if (currentState === STATE_RESULTS) refreshResultsDynamic();
}

// Refresh recommendations and map without going through chatbot again
function refreshResultsDynamic() {
    const recs = calculateRecommendations();
    selectedShelterId = recs[0].id;
    // Re-render cards
    document.getElementById("shelter-list").innerHTML = "";
    showRecommendations();
}

// ==========================================================================
// ★ v3: AUTO SIMULATION TICKER (every 6 seconds)
// ==========================================================================
function startAutoSim() {
    if (autoSimInterval) return;
    const events = [
        () => showToast("📊 수용 현황 갱신", "대피소 실시간 수용 현황이 갱신되었습니다."),
        () => showToast("🌊 수위 변화 감지", "중랑천 수위가 변동되었습니다. 경로 재분석 완료."),
        () => showToast("🚧 도로 상황 업데이트", "이문로 일부 구간 교통 통제 상태 변경."),
        () => showToast("🔄 혼잡도 자동 갱신", "대피소 혼잡도가 자동으로 업데이트되었습니다.")
    ];
    let i = 0;
    autoSimInterval = setInterval(() => {
        // Update occupancies
        SHELTER_DATABASE.forEach(s => {
            const shift = Math.floor(Math.random() * 15) - 5;
            s.occupancy = Math.max(10, Math.min(s.capacity, s.occupancy + shift));
        });
        events[i % events.length]();
        i++;
        if (currentState === STATE_RESULTS) {
            // Re-render shelter cards only
            const recs = calculateRecommendations();
            selectedShelterId = recs[0].id;
            renderShelterCards(recs);
        }
    }, 6000);
}

function stopAutoSim() {
    clearInterval(autoSimInterval);
    autoSimInterval = null;
}

function renderShelterCards(recommendations) {
    const listContainer = document.getElementById("shelter-list");
    if (!listContainer) return;
    const facilityIcons = {
        wheelchair:    "♿ 휠체어 램프",
        medical_center:"🏥 임시 의료진",
        pet_friendly:  "🐾 반려동물 수용",
        infant_care:   "🍼 영유아실"
    };

    listContainer.innerHTML = "";
    recommendations.forEach((shelter, idx) => {
        const rankNum    = idx + 1;
        const isSelected = shelter.id === selectedShelterId;
        const facilityTagsHTML = shelter.facilities.map(fac => {
            const req =
                (fac === "wheelchair"    && (userProfile.transport === "wheelchair" || userProfile.condition === "disabled")) ||
                (fac === "pet_friendly"  && userProfile.companion === "with_pet") ||
                (fac === "infant_care"   && (userProfile.companion === "with_child" || userProfile.condition === "child" || userProfile.condition === "pregnant")) ||
                (fac === "medical_center"&& (userProfile.companion === "with_elderly" || userProfile.condition === "elderly" || userProfile.condition === "pregnant"));
            return `<span class="facility-tag ${req ? 'highlight' : ''}">${facilityIcons[fac] || fac}</span>`;
        }).join("");

        let barColorClass = "bar-green", crowdText = "여유";
        if      (shelter.occupancyRate >= 85) { barColorClass = "bar-red";    crowdText = "혼잡 (만원 직전)"; }
        else if (shelter.occupancyRate >= 55) { barColorClass = "bar-orange"; crowdText = "보통"; }

        const card = document.createElement("div");
        card.className = `shelter-card ${isSelected ? 'selected' : ''} ${shelter.isUnusable ? 'shelter-unusable' : ''}`;
        card.setAttribute("data-id", shelter.id);
        card.innerHTML = `
            <div class="shelter-card-header">
                <span class="shelter-rank-tag rank-${rankNum}">${shelter.isUnusable ? '대피 불가' : rankNum+'순위 추천'}</span>
                <span class="shelter-match-score">${shelter.isUnusable ? '위험 등급' : shelter.finalScore+'점 적합'}</span>
            </div>
            <h3 class="shelter-name" style="${shelter.isUnusable ? 'color:var(--text-muted); text-decoration:line-through;':''}">${shelter.name}</h3>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">${shelter.desc}</p>
            ${shelter.isUnusable ? `<div style="font-size:0.85rem; color:var(--primary-red); font-weight:bold;">⚠️ 현재 재난상황에서 진입 불가.</div>` : `
                <div class="shelter-stats">
                    <div class="stat-item"><span>거리:</span><span class="stat-value-bold">${shelter.distance}m</span></div>
                    <div class="stat-item"><span>총 정원:</span><span class="stat-value-bold">${shelter.capacity}인</span></div>
                </div>
                <div class="occupancy-section">
                    <div class="occupancy-header">
                        <span>실시간 수용도 (${crowdText})</span>
                        <span>${shelter.occupancy} / ${shelter.capacity} 명 (${shelter.occupancyRate}%)</span>
                    </div>
                    <div class="occupancy-bar-bg"><div class="occupancy-bar-fill ${barColorClass}" style="width:${shelter.occupancyRate}%"></div></div>
                </div>
                <div class="facility-tags">${facilityTagsHTML}</div>
            `}
        `;
        if (!shelter.isUnusable) card.addEventListener("click", () => selectShelter(shelter.id));
        listContainer.appendChild(card);
    });
}

// ==========================================================================
// ★ v3: LOCALSTORAGE PROFILE PERSISTENCE
// ==========================================================================
const PROFILE_KEY = "safestep_v3_profile";

function saveProfile() {
    try {
        const data = { condition: userProfile.condition, companion: userProfile.companion, transport: userProfile.transport, ts: Date.now() };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
}

function loadProfile() {
    try {
        const raw = localStorage.getItem(PROFILE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) { return null; }
}

function clearProfile() {
    try { localStorage.removeItem(PROFILE_KEY); } catch (e) { /* ignore */ }
}

function checkSavedProfile() {
    const saved = loadProfile();
    if (!saved) return;

    const condNames = { child:"아동", adult:"성인", elderly:"고령자", pregnant:"임산부", disabled:"장애인/교통약자" };
    const compNames = { alone:"혼자", with_child:"아동동반", with_elderly:"노약자동반", with_pet:"반려동물동반" };
    const transNames = { foot:"도보", car:"차량", wheelchair:"휠체어" };

    const banner = document.getElementById("saved-profile-banner");
    document.getElementById("saved-profile-desc").innerText =
        `${condNames[saved.condition] || ''} · ${compNames[saved.companion] || ''} · ${transNames[saved.transport] || ''}`;
    banner.style.display = "flex";
}

// ==========================================================================
// DISASTER SWITCHER
// ==========================================================================
function setDisaster(disasterType) {
    selectedDisaster = disasterType;
    document.querySelector(".app-container").setAttribute("data-disaster", disasterType);

    document.querySelectorAll(".disaster-tab").forEach(tab => {
        tab.classList.toggle("active", tab.getAttribute("data-disaster") === disasterType);
    });

    const preset = DISASTER_PRESETS[disasterType];
    if (!preset) return;

    document.getElementById("alert-badge-text").innerText  = preset.badgeText;
    document.getElementById("alert-main-title").innerText  = preset.mainTitle;
    document.getElementById("alert-main-desc").innerText   = preset.mainDesc;
    document.getElementById("emergency-tip-1").innerText   = preset.tips[0];
    document.getElementById("emergency-tip-2").innerText   = preset.tips[1];
    document.getElementById("emergency-tip-3").innerText   = preset.tips[2];

    const simGrid = document.getElementById("sim-status-grid");
    simGrid.innerHTML = `
        <div class="sim-item">
            <span class="sim-label">${preset.weatherTitle}</span>
            <span class="sim-value text-red">${preset.weatherVal}</span>
        </div>
        <div class="sim-item" style="border-left-color: var(--primary-red);">
            <span class="sim-label">${preset.blockTitle}</span>
            <span class="sim-value text-orange">${preset.blockVal}</span>
        </div>
    `;
}

// ==========================================================================
// CLOCK
// ==========================================================================
function updateTime() {
    const el = document.getElementById("live-time");
    if (!el) return;
    const now = new Date();
    const hh  = String(now.getHours()).padStart(2,'0');
    const mm  = String(now.getMinutes()).padStart(2,'0');
    const ss  = String(now.getSeconds()).padStart(2,'0');
    el.innerText = `${hh}:${mm}:${ss} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
}

// ==========================================================================
// DOM READY — EVENT BINDINGS
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Clock
    updateTime();
    setInterval(updateTime, 1000);

    // Default disaster
    setDisaster("flood");

    // Check saved profile
    checkSavedProfile();

    // ★ Location picker
    document.querySelectorAll(".location-card").forEach(card => {
        card.addEventListener("click", () => {
            document.querySelectorAll(".location-card").forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            const key = card.getAttribute("data-location");
            USER_LOCATION = { ...LOCATIONS[key] };

            // Update legend
            const legendUser = document.querySelector(".legend-item span:not(.legend-dot)");
            // also update map legend text if on results
            if (currentState === STATE_RESULTS) {
                document.getElementById("summary-location").innerText = `📍 ${USER_LOCATION.short || USER_LOCATION.name}`;
                const recs = calculateRecommendations();
                selectedShelterId = recs[0].id;
                renderShelterCards(recs);
                renderSVGMap(recs);
                updateRouteDetails(selectedShelterId);
            }
        });
    });

    // Disaster tabs
    document.querySelectorAll(".disaster-tab").forEach(tab => {
        tab.addEventListener("click", () => setDisaster(tab.getAttribute("data-disaster")));
    });

    // Start chatbot
    const btnStart = document.getElementById("btn-start");
    if (btnStart) btnStart.addEventListener("click", startChatbot);

    // Saved profile load/dismiss
    const btnLoad    = document.getElementById("btn-load-profile");
    const btnDismiss = document.getElementById("btn-dismiss-profile");
    if (btnLoad) {
        btnLoad.addEventListener("click", () => {
            document.getElementById("saved-profile-banner").style.display = "none";
            startChatbot();
        });
    }
    if (btnDismiss) {
        btnDismiss.addEventListener("click", () => {
            document.getElementById("saved-profile-banner").style.display = "none";
            clearProfile();
        });
    }

    // Resets
    const btnResetHeader  = document.getElementById("btn-reset-header");
    const btnResetResults = document.getElementById("btn-reset-results");
    const btnRestartAll   = document.getElementById("btn-restart-all");

    const resetFn = () => { changeScreen("screen-alert"); setDisaster(selectedDisaster); };
    [btnResetHeader, btnResetResults, btnRestartAll].forEach(btn => { if (btn) btn.addEventListener("click", resetFn); });

    // ★ Control center toggle (collapse)
    const ccToggle = document.getElementById("control-center-toggle");
    const ccBody   = document.getElementById("control-center-body");
    if (ccToggle) {
        ccToggle.addEventListener("click", () => {
            ccBody.classList.toggle("collapsed");
            ccToggle.classList.toggle("collapsed");
        });
    }

    // ★ Manual trigger buttons
    document.querySelectorAll(".ctrl-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const action = btn.getAttribute("data-action");
            if (action) applyOverride(action);
        });
    });

    // ★ Auto-simulation toggle
    const autoToggle = document.getElementById("toggle-auto-sim");
    if (autoToggle) {
        autoToggle.addEventListener("change", () => {
            if (autoToggle.checked) {
                startAutoSim();
                showToast("🔄 자동 시뮬레이션 시작", "6초마다 재난 상황이 자동 갱신됩니다.");
            } else {
                stopAutoSim();
            }
        });
    }

    // ★ Toast close button
    const toastClose = document.getElementById("toast-close");
    if (toastClose) {
        toastClose.addEventListener("click", () => {
            document.getElementById("realtime-toast").classList.remove("show");
            clearTimeout(toastTimeout);
        });
    }
});

// Expose for inline SVG onclick
window.selectShelter = selectShelter;
window.startChatbot  = startChatbot;
