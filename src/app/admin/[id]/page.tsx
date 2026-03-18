"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SurveyForm, { SurveyFormData } from "@/components/survey-form";
import { Loading } from "@wanteddev/wds";
import { PageContent } from "@/components/page-content";

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
          questions: data.questions || [],
        });
      })
      .catch(() => setError("설문을 불러올 수 없습니다."));
  }, [surveyId]);

  if (error) {
    return (
      <PageContent size="sm" className="py-12 text-center">
        <p className="text-destructive">{error}</p>
      </PageContent>
    );
  }

  if (!surveyData) {
    return (
      <PageContent size="sm" className="py-12 flex items-center justify-center gap-2">
        <Loading variant="circular" size="20px" />
        <p className="text-muted-foreground">설문을 불러오는 중...</p>
      </PageContent>
    );
  }

  return (
    <SurveyForm mode="edit" initialData={surveyData} surveyId={surveyId} />
  );
}
