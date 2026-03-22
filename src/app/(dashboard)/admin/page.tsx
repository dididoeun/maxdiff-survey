"use client";

import SurveyForm from "@/components/survey-form";

export default function AdminPage() {
  return (
    <div style={{ height: "calc(100vh - 60px)" }}>
      <SurveyForm mode="create" />
    </div>
  );
}
