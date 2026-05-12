// Devotional Editorial 스타일: paper-tone 배경, ink-blue 액센트
// 마일스톤 3 - 출석 입력 페이지
// - 가장 최근 일요일을 기본 날짜로 설정
// - 학년/반 필터, 학생 카드 형태의 도장(stamp) 토글
// - Optimistic UI + Supabase upsert/delete
// - 반별 → 남/여 그룹핑 표시 (마일스톤 4-6)
import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase, type Student, type Attendance, type AbsenceNote } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ChevronLeft, ChevronRight, Eye, ShieldCheck, MessageSquare, Check } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// 가장 최근 일요일 (오늘 포함)
function lastSunday(d: Date = new Date()): string {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  return x.toISOString().slice(0, 10);
}

function shiftDate(yyyymmdd: string, days: number): string {
  const d = new Date(yyyymmdd);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// 성별 정규화: 다양한 입력값을 '남'/'여'/'미지정'으로 통일
function normalizeGender(g: string | null): "남" | "여" | "미지정" {
  if (!g) return "미지정";
  const v = g.trim().toLowerCase();
  if (v === "남" || v === "m" || v === "male" || v === "boy") return "남";
  if (v === "여" || v === "f" || v === "female" || v === "girl") return "여";
  return "미지정";
}

// 반별 → 성별 그룹 구조
interface GenderGroup {
  gender: "남" | "여" | "미지정";
  students: Student[];
}
interface ClassGroup {
  classKey: string; // grade + class_num 조합 (예: "1학년 1반")
  grade: string;
  classNum: string;
  genderGroups: GenderGroup[];
}

export default function Home() {
  const { isAdmin, user, profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<string, Attendance>>(new Map());
  const [notes, setNotes] = useState<Map<string, AbsenceNote>>(new Map()); // key: student_id
  const [date, setDate] = useState<string>(lastSunday());
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);

  // 학생 명단 로드 (1회)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("grade")
        .order("class_num")
        .order("name");
      if (cancelled) return;
      if (error) {
        toast.error("학생 명단 로드 실패: " + error.message);
      } else {
        setStudents((data as Student[]) ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 선택된 날짜의 출석 기록 + 결석 사유 메모 로드
  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    (async () => {
      const [attRes, noteRes] = await Promise.all([
        supabase.from("attendance").select("*").eq("attendance_date", date),
        supabase.from("absence_notes").select("*").eq("attend_date", date),
      ]);
      if (cancelled) return;
      if (attRes.error) {
        toast.error("출석 로드 실패: " + attRes.error.message);
      } else {
        const m = new Map<string, Attendance>();
        for (const a of (attRes.data as Attendance[]) ?? []) m.set(a.student_id, a);
        setAttendance(m);
      }
      if (noteRes.error) {
        toast.error("메모 로드 실패: " + noteRes.error.message);
      } else {
        const nm = new Map<string, AbsenceNote>();
        for (const n of (noteRes.data as AbsenceNote[]) ?? []) nm.set(n.student_id, n);
        setNotes(nm);
      }
      setFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  // 필터 옵션 추출
  const grades = useMemo(
    () => Array.from(new Set(students.map((s) => s.grade))).sort(),
    [students],
  );
  const classes = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .filter((s) => gradeFilter === "ALL" || s.grade === gradeFilter)
            .map((s) => s.class_num),
        ),
      ).sort(),
    [students, gradeFilter],
  );

  const filtered = students.filter(
    (s) =>
      (gradeFilter === "ALL" || s.grade === gradeFilter) &&
      (classFilter === "ALL" || s.class_num === classFilter),
  );

  // presentCount는 컨트롤 바에서 제거됨 (행동 지표로 전환)
  // 반/성별 헤더에서 직접 집계

  // 반별 → 성별 그룹 구조 생성
  const classGroups = useMemo<ClassGroup[]>(() => {
    // 반 목록 (정렬 순서 유지)
    const classKeys = Array.from(
      new Set(filtered.map((s) => `${s.grade}||${s.class_num}`)),
    ).sort();

    return classKeys.map((key) => {
      const [grade, classNum] = key.split("||");
      const classStudents = filtered.filter(
        (s) => s.grade === grade && s.class_num === classNum,
      );

      // 성별 그룹: 남 → 여 → 미지정 순서
      const genderOrder: ("남" | "여" | "미지정")[] = ["남", "여", "미지정"];
      const genderGroups: GenderGroup[] = genderOrder
        .map((gender) => ({
          gender,
          students: classStudents.filter((s) => normalizeGender(s.gender) === gender),
        }))
        .filter((g) => g.students.length > 0);

      return {
        classKey: key,
        grade,
        classNum: classNum,
        genderGroups,
      };
    });
  }, [filtered, attendance]); // eslint-disable-line react-hooks/exhaustive-deps

  // 출석 토글 (Optimistic + Supabase)
  async function toggle(student: Student) {
    if (!isAdmin) {
      toast.error("입력 권한이 없습니다", {
        description: user ? "관리자만 출석을 수정할 수 있습니다." : "로그인 후 관리자 권한이 필요합니다.",
      });
      return;
    }
    const current = attendance.get(student.id);
    const next = !current?.status;

    // Optimistic
    setSaving((prev) => new Set(prev).add(student.id));
    setAttendance((prev) => {
      const m = new Map(prev);
      if (current) {
        m.set(student.id, { ...current, status: next });
      } else {
        m.set(student.id, {
          id: "tmp-" + student.id,
          student_id: student.id,
          attendance_date: date,
          status: next,
          created_at: new Date().toISOString(),
        });
      }
      return m;
    });

    // 서버 반영
    const { error, data } = await supabase
      .from("attendance")
      .upsert(
        {
          student_id: student.id,
          attendance_date: date,
          status: next,
        },
        { onConflict: "student_id,attendance_date" },
      )
      .select()
      .single();

    if (error) {
      // 롤백
      setAttendance((prev) => {
        const m = new Map(prev);
        if (current) m.set(student.id, current);
        else m.delete(student.id);
        return m;
      });
      toast.error(`${student.name} 저장 실패: ${error.message}`);
    } else if (data) {
      setAttendance((prev) => {
        const m = new Map(prev);
        m.set(student.id, data as Attendance);
        return m;
      });
    }

    setSaving((prev) => {
      const s = new Set(prev);
      s.delete(student.id);
      return s;
    });
  }

  // 메모 저장 (누구나 가능, Optimistic)
  async function saveNote(studentId: string, text: string) {
    const trimmed = text.trim().slice(0, 500);
    const current = notes.get(studentId);

    // 변경이 없으면 무시
    if ((current?.note ?? "") === trimmed) return;

    setSaving((prev) => new Set(prev).add("note:" + studentId));

    if (trimmed === "") {
      setSaving((p) => {
        const s = new Set(p);
        s.delete("note:" + studentId);
        return s;
      });
      return;
    }

    // Optimistic
    const optimistic: AbsenceNote = current
      ? { ...current, note: trimmed, updated_at: new Date().toISOString() }
      : {
          id: "tmp-" + studentId,
          attend_date: date,
          student_id: studentId,
          note: trimmed,
          author_name: profile?.display_name || user?.email || null,
          author_id: user?.id ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
    setNotes((prev) => new Map(prev).set(studentId, optimistic));

    const payload: Partial<AbsenceNote> = {
      attend_date: date,
      student_id: studentId,
      note: trimmed,
      author_name: profile?.display_name || user?.email || null,
      author_id: user?.id ?? null,
    };

    const { data, error } = await supabase
      .from("absence_notes")
      .upsert(payload, { onConflict: "attend_date,student_id" })
      .select()
      .single();

    if (error) {
      // 롤백
      setNotes((prev) => {
        const m = new Map(prev);
        if (current) m.set(studentId, current);
        else m.delete(studentId);
        return m;
      });
      toast.error("메모 저장 실패: " + error.message);
    } else if (data) {
      setNotes((prev) => new Map(prev).set(studentId, data as AbsenceNote));
      toast.success("메모를 저장했습니다", { duration: 1500 });
    }
    setSaving((p) => {
      const s = new Set(p);
      s.delete("note:" + studentId);
      return s;
    });
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Masthead */}
        <header className="mb-8">
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Issue · {date}
          </div>
          <h1 className="font-display text-4xl italic mt-1">
            {isAdmin ? "출석 입력" : "출석 조회"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {isAdmin
              ? "학생 카드를 누르면 도장이 찍힙니다. 변경은 즉시 반영되며 네트워크 실패 시 자동 복원됩니다."
              : "조회 전용 모드입니다. 출석 입력은 관리자 권한이 필요합니다."}
          </p>
          {!isAdmin && (
            <div className="mt-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-wider px-3 py-1.5 bg-foreground/5 border border-foreground/15 text-muted-foreground">
              {user ? <Eye className="size-3" /> : <ShieldCheck className="size-3" />}
              {user ? "Viewer·읽기 전용" : <>관리자이시라면 <Link href="/login"><a className="underline ml-1">로그인</a></Link></>}
            </div>
          )}
        </header>

        {/* Controls */}
        <div className="bg-white/60 backdrop-blur-sm border border-foreground/10 px-5 py-4 mb-8 grid sm:grid-cols-[auto_1fr_1fr] gap-4 items-end">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              날짜
            </label>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDate(shiftDate(date, -7))}
                aria-label="이전 주"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-40"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDate(shiftDate(date, 7))}
                aria-label="다음 주"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              학년
            </label>
            <select
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value);
                setClassFilter("ALL");
              }}
              className="w-full bg-background border border-input rounded-md h-9 px-3 text-sm"
            >
              <option value="ALL">전체</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              반
            </label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full bg-background border border-input rounded-md h-9 px-3 text-sm"
            >
              <option value="ALL">전체</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>


        </div>

        {/* Student Cards - 반별/남여 그룹핑 */}
        {fetching ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="animate-spin size-4" />
            출석 데이터 로드 중…
          </div>
        ) : classGroups.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-12">
            조건에 해당하는 학생이 없습니다.
          </div>
        ) : (
          <div className="space-y-10">
            {classGroups.map((cg) => {
              // 반 전체 출석 카운트
              const classStudentIds = cg.genderGroups.flatMap((g) => g.students.map((s) => s.id));
              const classPresentCount = classStudentIds.filter(
                (id) => attendance.get(id)?.status,
              ).length;

              return (
                <section key={cg.classKey}>
                  {/* 반 헤더 - 행동 지표: 출석·결석·메모 */}
                  {(() => {
                    const classAbsentCount = classStudentIds.length - classPresentCount;
                    const classMemoCount = classStudentIds.filter(
                      (id) => notes.get(id)?.note,
                    ).length;
                    return (
                      <div className="flex items-baseline gap-3 mb-4 border-b-2 border-[oklch(0.32_0.05_250)] pb-2">
                        <h2 className="font-display text-2xl italic text-[oklch(0.32_0.05_250)]">
                          {cg.grade} {cg.classNum}
                        </h2>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          출석 {classPresentCount}
                          {classAbsentCount > 0 && (
                            <span className="text-[oklch(0.55_0.15_25)] ml-2">결석 {classAbsentCount}</span>
                          )}
                          {classMemoCount > 0 && (
                            <span className="text-muted-foreground/70 ml-2">· 메모 {classMemoCount}</span>
                          )}
                        </span>
                      </div>
                    );
                  })()}

                  {/* 성별 그룹 */}
                  <div className="space-y-5">
                    {cg.genderGroups.map((gg) => {
                      const genderPresentCount = gg.students.filter(
                        (s) => attendance.get(s.id)?.status,
                      ).length;

                      return (
                        <div key={gg.gender}>
                          {/* 성별 서브헤더 - 행동 지표: 출석·결석·메모 */}
                          {(() => {
                            const genderAbsentCount = gg.students.length - genderPresentCount;
                            const genderMemoCount = gg.students.filter(
                              (s) => notes.get(s.id)?.note,
                            ).length;
                            return (
                              <div className="flex items-center gap-2 mb-2.5">
                                <span
                                  className={cn(
                                    "inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium border",
                                    gg.gender === "남"
                                      ? "bg-[oklch(0.93_0.04_250)] border-[oklch(0.75_0.08_250)] text-[oklch(0.32_0.05_250)]"
                                      : gg.gender === "여"
                                      ? "bg-[oklch(0.95_0.04_10)] border-[oklch(0.78_0.08_10)] text-[oklch(0.42_0.1_10)]"
                                      : "bg-foreground/5 border-foreground/20 text-muted-foreground",
                                  )}
                                >
                                  {gg.gender}
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  출석 {genderPresentCount}
                                  {genderAbsentCount > 0 && (
                                    <span className="text-[oklch(0.55_0.15_25)] ml-1.5">결석 {genderAbsentCount}</span>
                                  )}
                                  {genderMemoCount > 0 && (
                                    <span className="text-muted-foreground/60 ml-1.5">· 메모 {genderMemoCount}</span>
                                  )}
                                </span>
                                <div className="flex-1 h-px bg-foreground/10" />
                              </div>
                            );
                          })()}

                          {/* 학생 카드 그리드 */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                            {gg.students.map((s) => {
                              const present = attendance.get(s.id)?.status ?? false;
                              const isSaving = saving.has(s.id);
                              const note = notes.get(s.id);
                              const noteSaving = saving.has("note:" + s.id);
                              const noteOpen = openNoteFor === s.id;
                              const hasNote = !!note?.note;
                              return (
                                <div
                                  key={s.id}
                                  className={cn(
                                    "relative bg-white border transition-all duration-150",
                                    present
                                      ? "border-[oklch(0.45_0.18_25)] bg-[oklch(0.99_0.005_85)]"
                                      : "border-foreground/15",
                                  )}
                                >
                                  {/* 상단 토글 영역 (admin만 클릭) */}
                                  <button
                                    type="button"
                                    onClick={() => toggle(s)}
                                    disabled={isSaving || !isAdmin}
                                    className={cn(
                                      "w-full text-left px-3 py-2.5",
                                      isAdmin
                                        ? "hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                                        : "cursor-default",
                                    )}
                                  >
                                    <div className="font-display text-base leading-tight mt-0.5">
                                      {s.name}
                                    </div>
                                  </button>

                                  {/* Stamp */}
                                  {present && (
                                    <div
                                      className="absolute -top-2 -right-2 size-10 rounded-full border-2 border-[oklch(0.45_0.18_25)] text-[oklch(0.45_0.18_25)] flex items-center justify-center font-display italic text-[9px] tracking-wider rotate-[-12deg] bg-white/90 shadow-sm"
                                      style={{ fontFeatureSettings: '"smcp"' }}
                                    >
                                      출석
                                    </div>
                                  )}
                                  {isSaving && (
                                    <Loader2 className="absolute top-2 right-2 size-3 animate-spin text-muted-foreground" />
                                  )}

                                  {/* 메모 영역 - 결석시에만 노출 */}
                                  {!present && (
                                    <div className="border-t border-foreground/10 px-2.5 py-1.5">
                                      {noteOpen ? (
                                        <NoteEditor
                                          initial={note?.note ?? ""}
                                          saving={noteSaving}
                                          onSave={async (v) => {
                                            await saveNote(s.id, v);
                                            setOpenNoteFor(null);
                                          }}
                                          onCancel={() => setOpenNoteFor(null)}
                                        />
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setOpenNoteFor(s.id)}
                                          className={cn(
                                            "w-full text-left text-xs flex items-start gap-1 hover:text-foreground transition-colors",
                                            hasNote ? "text-foreground/80" : "text-muted-foreground",
                                          )}
                                        >
                                          <MessageSquare className="size-3 mt-0.5 shrink-0" />
                                          <span className="line-clamp-2 text-[11px]">
                                            {hasNote ? note!.note : "결석 사유…"}
                                          </span>
                                        </button>
                                      )}
                                      {hasNote && !noteOpen && note?.author_name && (
                                        <div className="text-[10px] text-muted-foreground/70 mt-0.5 uppercase tracking-wider">
                                          · {note.author_name}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// 결석 사유 메모 인라인 에디터
function NoteEditor({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: string;
  saving: boolean;
  onSave: (v: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.setSelectionRange(value.length, value.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-1.5">
      <textarea
        ref={ref}
        value={value}
        maxLength={500}
        rows={2}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSave(value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="결석 사유 (예: 가족 여행, 병결 등) · ⌘/Ctrl+Enter 저장"
        className="w-full text-xs px-2 py-1.5 border border-foreground/20 bg-white resize-none focus:outline-none focus:border-[oklch(0.32_0.05_250)]"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-muted-foreground">
          {value.length}/500 · 누구나 작성 가능
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={onCancel}
            disabled={saving}
          >
            취소
          </Button>
          <Button
            size="sm"
            className="h-6 px-2 text-[10px] bg-[oklch(0.32_0.05_250)] hover:bg-[oklch(0.28_0.05_250)]"
            onClick={() => onSave(value)}
            disabled={saving}
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}
