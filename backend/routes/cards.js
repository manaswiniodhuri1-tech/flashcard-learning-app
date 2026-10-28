const express = require("express");
const supabase = require("../supabase");

const router = express.Router();
const DIFFICULTIES = new Set(["Easy", "Medium", "Hard"]);

function validateCard(body, partial = false) {
  const errors = [];
  const output = {};
  if (!partial || Object.hasOwn(body, "question")) {
    if (typeof body.question !== "string" || !body.question.trim()) errors.push("Question is required.");
    else if (body.question.trim().length > 500) errors.push("Question must be 500 characters or fewer.");
    else output.question = body.question.trim();
  }
  if (!partial || Object.hasOwn(body, "answer")) {
    if (typeof body.answer !== "string" || !body.answer.trim()) errors.push("Answer is required.");
    else if (body.answer.trim().length > 1000) errors.push("Answer must be 1,000 characters or fewer.");
    else output.answer = body.answer.trim();
  }
  if (!partial || Object.hasOwn(body, "category")) {
    if (body.category !== undefined && typeof body.category !== "string") errors.push("Subject must be text.");
    else {
      const category = (body.category || "General").trim();
      if (!category || category.length > 60) errors.push("Subject must be between 1 and 60 characters.");
      else output.category = category;
    }
  }
  if (Object.hasOwn(body, "difficulty")) {
    if (!DIFFICULTIES.has(body.difficulty)) errors.push("Difficulty must be Easy, Medium, or Hard.");
    else output.difficulty = body.difficulty;
  } else if (!partial) output.difficulty = "Medium";

  if (Object.hasOwn(body, "known")) {
    if (typeof body.known !== "boolean") errors.push("Known must be true or false.");
    else output.known = body.known;
  }
  return { errors, output };
}

router.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from("flashcards")
      .select("id, question, answer, category, difficulty, known, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ data });
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    const { errors, output } = validateCard(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const { data, error } = await supabase.from("flashcards").insert(output)
      .select("id, question, answer, category, difficulty, known, created_at, updated_at").single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) { next(error); }
});

router.patch("/:id", async (req, res, next) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(400).json({ error: "Invalid flashcard ID." });
    }
    const { errors, output } = validateCard(req.body, true);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    if (!Object.keys(output).length) return res.status(400).json({ error: "Provide at least one field to update." });
    const { data, error } = await supabase.from("flashcards").update(output).eq("id", req.params.id)
      .select("id, question, answer, category, difficulty, known, created_at, updated_at").maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Flashcard not found." });
    res.json({ data });
  } catch (error) { next(error); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(400).json({ error: "Invalid flashcard ID." });
    }
    const { data, error } = await supabase.from("flashcards").delete().eq("id", req.params.id)
      .select("id").maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Flashcard not found." });
    res.json({ data: { id: data.id, deleted: true } });
  } catch (error) { next(error); }
});

module.exports = router;
