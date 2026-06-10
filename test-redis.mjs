import { saveWorkingMemory, getWorkingMemory, saveSoulState, getSoulState } from "./src/memory/working.mjs";

async function testRedis() {
    const testUserId = "9999999";
    
    console.log("Menyimpan ke Redis...");
    await saveWorkingMemory(testUserId, "user", "Halo ini test redis");
    await saveSoulState(testUserId, { mood: "happy", energy: 95 });
    
    console.log("Mengambil dari Redis...");
    const memory = await getWorkingMemory(testUserId, 5);
    const soul = await getSoulState(testUserId);
    
    console.log("Memory:", memory);
    console.log("Soul:", soul);
}

testRedis();
