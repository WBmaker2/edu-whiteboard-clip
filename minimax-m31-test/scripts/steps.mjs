export const STEPS = {
  zoo: async (page, shot) => {
    await page.getByRole("button", { name: "강아지" }).click();
    await page.waitForTimeout(800);
    await shot("02-강아지");
    await page.getByRole("button", { name: "동물 추가" }).click();
    await page.waitForTimeout(600);
    await shot("03-추가후");
    await page.getByRole("button", { name: "모두 걷기" }).click();
    await page.waitForTimeout(1200);
    await shot("04-걷기");
  },
  molecule: async (page, shot) => {
    await page.getByRole("button", { name: "물 (H₂O)" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "예시 불러오기" }).click();
    await page.waitForTimeout(900);
    await shot("02-예시");
    await page.getByRole("button", { name: "자동 배치" }).click();
    await page.waitForTimeout(1200);
    await shot("03-자동배치");
    await page.getByRole("button", { name: "검사" }).click();
    await page.waitForTimeout(400);
    await shot("04-검사");
    await page.getByRole("button", { name: "암모니아 (NH₃)" }).click();
    await page.getByRole("button", { name: "예시 불러오기" }).click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "자동 배치" }).click();
    await page.waitForTimeout(1400);
    await shot("05-암모니아");
  },
  defense: async (page, shot) => {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    await page.getByRole("button", { name: "고속" }).click();
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.42);
    await page.waitForTimeout(600);
    await shot("02-타워배치");
    await page.getByRole("button", { name: "다음 웨이브" }).click();
    await page.getByRole("button", { name: "배속 1×" }).click();
    await page.waitForTimeout(3000);
    await shot("03-전투");
    await page
      .waitForFunction(() => window.__gameApi?.getState?.().waveActive === false, null, { timeout: 40000 })
      .catch(() => console.log("WARN: 웨이브가 제한 시간 안에 끝나지 않음"));
    await page.waitForTimeout(400);
    await shot("04-웨이브종료");
  },
};

export const CARD_SETUP = {
  zoo: async (page) => {
    await page.getByRole("button", { name: "동물 추가" }).click();
    await page.waitForTimeout(400);
  },
  molecule: async (page) => {
    await page.getByRole("button", { name: "물 (H₂O)" }).click();
    await page.getByRole("button", { name: "예시 불러오기" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "자동 배치" }).click();
    await page.waitForTimeout(1400);
  },
  defense: async (page) => {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    await page.getByRole("button", { name: "고속" }).click();
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.42);
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "다음 웨이브" }).click();
    await page.waitForTimeout(2600);
  },
};
