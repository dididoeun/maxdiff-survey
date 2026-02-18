"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SurveyForm, { SurveyFormData } from "@/components/survey-form";
import { Spinner } from "@/components/ui/spinner";

export default function EditSurveyPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const [surveyData, setSurveyData] = useState<SurveyFormData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/surveys/${surveyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setSurveyData({
          title: data.title,
          items: data.items,
          setSize: data.setSize,
          jobRoles: data.jobRoles,
          status: data.status,
        });
      })
      .catch(() => setError("설문을 불러올 수 없습니다."));
  }, [surveyId]);

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!surveyData) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex items-center justify-center gap-2">
        <Spinner />
        <p className="text-muted-foreground">설문을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <SurveyForm mode="edit" initialData={surveyData} surveyId={surveyId} />
  );
}
