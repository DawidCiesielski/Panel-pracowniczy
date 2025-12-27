document.addEventListener("DOMContentLoaded", function() {
    
    const calendarEl = document.getElementById("calendar");
    function isMobile() {
      return window.innerWidth < 768;     // próg możesz zmienić
    }

    function getInitialView() {
      // desktop: tydzień z godzinami, mobile: lista dnia
      return isMobile() ? 'timeGridDay' : 'timeGridWeek';
    }
    // ---- MODAL DODAWANIA ----
    const createTaskModal = document.getElementById("createTaskModal");
    const createTaskModalClose = document.getElementById("createTaskModalClose");
    const createTaskForm = document.getElementById("createTaskForm");
    const inputContent = document.getElementById("content");
    const inputStatus = document.getElementById("complete");
    const inputDescription = document.getElementById("description");

    // tu będziemy trzymać start z klikniętego miejsca
    let selectedStart = null;
    let selectedEnd = null;
    let editingEvent = null;
    let eventToDelete = null;

    function openDeleteTaskModal(event) {
      eventToDelete = event;
      deleteTaskText.textContent =
        `Czy na pewno chcesz usunąć zadanie: "${event.title || 'bez nazwy'}"?`;
      deleteTaskModal.classList.remove("hidden");
    }

    function closeDeleteTaskModal() {
      deleteTaskModal.classList.add("hidden");
      eventToDelete = null;
      }
        cancelDeleteTask.addEventListener("click", closeDeleteTaskModal);
    deleteTaskModal.addEventListener("click", (e) => {
      if (e.target === deleteTaskModal) {
        closeDeleteTaskModal();
      }
    });
    function openCreateTaskModal() {
      editingEvent = null; // tryb tworzenia

      // zmień nagłówek i tekst przycisku
      document.querySelector("#createTaskModal h2").textContent = "Dodaj zadanie";
      document.getElementById("btn_add").value = "Utwórz zadanie";

      inputContent.value = "";
      inputDescription.value = "";
      inputStatus.value = "0";
      createTaskModal.classList.remove("hidden");
    }


    function openEditTaskModal(event) {
      editingEvent = event; // zapamiętujemy, który event edytujemy

      document.querySelector("#createTaskModal h2").textContent = "Edytuj zadanie";
      document.getElementById("btn_add").value = "Zapisz zmiany";

      // wczytanie danych – content może być w extendedProps, a jak nie ma, to użyj title
      const contentVal = event.extendedProps.content || event.title || "";
      const descVal = event.extendedProps.description || event.description || "";
      const statusVal = event.extendedProps.complete ?? 0;

      inputContent.value = contentVal;
      inputDescription.value = descVal;
      inputStatus.value = String(statusVal);

      // ustaw zakres, żeby submit miał start/end
      selectedStart = event.startStr;
      selectedEnd = event.endStr;

      createTaskModal.classList.remove("hidden");
    }

    function closeCreateTaskModal() {
      createTaskModal.classList.add("hidden");
    }

    createTaskModalClose.addEventListener("click", closeCreateTaskModal);
    createTaskModal.addEventListener("click", (e) => {
      if (e.target === createTaskModal) {
        closeCreateTaskModal();
      }
    });
    // ---- OVERDUE / CZERWONE ZADANIA ----

// Zwraca true, jeśli event jest po czasie i nie ma complete = 2 (zakończone).
function isEventOverdue(event) {
  // complete: 0 = nierozpoczęte, 1 = w trakcie, 2 = zakończone
  const complete =
    (event.extendedProps && event.extendedProps.complete) ??
    event.complete ??
    0;

  // zakończone → nigdy nie spóźnione
  if (complete === 2) return false;

  const now = new Date();
  const end = event.end || event.start;
  if (!end) return false;

  return end < now;
}

// Ustawia kolor eventu w zależności od complete + czasu
// 0 = nierozpoczęte, 1 = w trakcie, 2 = zakończone
function updateEventOverdueStyling(event) {
  if (!event) return;

  const complete =
    (event.extendedProps && event.extendedProps.complete) ??
    event.complete ??
    0;

  const now = new Date();
  const end = event.end || event.start;
  const isOverdue = complete !== 2 && end && end < now;

  // usuń stare klasy statusu
  let classes = event.classNames ? [...event.classNames] : [];
  classes = classes.filter(
    c => c !== "fc-event-overdue" && c !== "fc-event-complete"
  );

  // dodaj odpowiednią klasę
  if (isOverdue) {
    classes.push("fc-event-overdue");      // czerwony
  } else if (complete === 2) {
    classes.push("fc-event-complete");     // zielony
  }

  event.setProp("classNames", classes);
}
    // ---- INICJALIZACJA KALENDARZA ----

    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: getInitialView(),
      locale: 'pl',
      firstDay: 1,

      allDaySlot: false,

      slotMinTime: '06:00:00',
      slotMaxTime: '22:00:00',
      slotDuration: '00:15:00',

      nowIndicator: true, 

      slotLabelInterval: '01:00',
      slotLabelFormat: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      },
      
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: isMobile()
          ? 'timeGridDay,listWeek'                // na telefonie tylko listy
          : 'dayGridMonth,timeGridWeek,timeGridDay' // na desktopie więcej
      },
      buttonText: {
        today: 'Dziś',
        month: 'Miesiąc',
        week: 'Tydzień',
        day: 'Dzień'
      },

      editable: true,
      eventDurationEditable: true,
      events: "/api/tasks/all",
        /* 🔥 to dodaj */
      selectable: true,        // pozwala zaznaczać zakres myszką
      selectMirror: true,      // podgląd zaznaczenia
      unselectAuto: true,
      // 🔹 klik w puste miejsce → zapamiętaj start i pokaż modal
      dateClick: function(info) {
        selectedStart = info.dateStr;   // np. "2025-12-06T10:30:00+01:00"
        selectedEnd = null;
        openCreateTaskModal();
      },
       eventDidMount: function(info) {
        if (info.view.type.indexOf('list') === 0) {
          info.el.style.position = 'relative';
        }
        const btn = document.createElement("button");
        btn.className = "event-delete-btn";
        btn.innerHTML = "&times;";

        // kliknięcie w X nie powinno wywołać eventClick
        btn.addEventListener("click", function(e) {
          e.stopPropagation();
          openDeleteTaskModal(info.event);
        });
        info.el.appendChild(btn);
        updateEventOverdueStyling(info.event);
      },
      // 🔹 klik w event -> modal podglądu (jak miałeś)
      eventClick: function(info) {
        // ALT + CLICK → DUPLIKACJA (zostaje tak jak było)
        if (info.jsEvent.altKey) {
          info.jsEvent.preventDefault();
          info.jsEvent.stopPropagation();

          fetch(`/api/tasks/${info.event.id}/duplicate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({})
          })
          .then(res => {
            if (!res.ok) {
              return res.text().then(t => { throw new Error(t || "Błąd HTTP"); });
            }
            return res.json();
          })
          .then(data => {
            calendar.addEvent({
              id: data.id,
              title: data.title,
              start: data.start,
              end: data.end,
              complete: data.complete,
              extendedProps: {
                description: data.description,
                content: data.content,
              }
            });
          })
          .catch(err => {
            console.error(err);
            alert("Nie udało się zduplikować zadania");
          });

          return;
        }

        // ZWYKŁY CLICK → EDYCJA
        openEditTaskModal(info.event);
      },


      eventDrop: function (info) {
        const event = info.event;

        fetch(`/api/tasks/${event.id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start: event.startStr,
            end: event.endStr
          })
        }).then(response => {
          if (!response.ok) {
            alert("Błąd przy zapisie daty zadania");
            info.revert();
          }
          else{
              updateEventOverdueStyling(event);
          }
        }).catch(err => {
          console.error(err);
          alert("Błąd sieci");
          info.revert();
        });
      },

      eventResize: function (info) {
        const event = info.event;

        fetch(`/api/tasks/${event.id}/resize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start: event.startStr,
            end: event.endStr
          })
        }).then(res => {
          if (!res.ok) {
            alert("Błąd przy zmianie długości zadania");
            info.revert();
          } else{
              updateEventOverdueStyling(event);
          }
        }).catch(err => {
          console.error(err);
          alert("Błąd sieci");
          info.revert();
        });
      },
        select: function(info) {
          // info.start / info.end to obiekty Date
          // info.startStr / info.endStr to ISO stringi (takie jak w eventach)
          selectedStart = info.startStr;
          selectedEnd = info.endStr;

          openCreateTaskModal();}
    });
    
    calendar.render();
    window.addEventListener('resize', function () {
    const newView = getInitialView();  // używa isMobile()
      if (calendar.view.type !== newView) {
        calendar.changeView(newView);
      }
    });
    function refreshOverdueEvents() {
      const events = calendar.getEvents();
      events.forEach(updateEventOverdueStyling);
    }

    // od razu po starcie
    refreshOverdueEvents();
    confirmDeleteTask.addEventListener("click", function() {
    if (!eventToDelete) return;

    const id = eventToDelete.id;

    fetch(`/api/tasks/${id}/delete`, {
      method: "POST",              // albo DELETE, jak wolisz
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })
    .then(res => {
      if (!res.ok) {
        return res.text().then(t => { throw new Error(t || "Błąd HTTP"); });
      }
      // usuwamy z kalendarza
      eventToDelete.remove();
      refreshOverdueEvents();
      closeDeleteTaskModal();
    })
    .catch(err => {
      console.error(err);
      alert("Nie udało się usunąć zadania");
    });
  });
    // 🔹 submit modala – wysyłamy content, description i start z kliknięcia
  createTaskForm.addEventListener("submit", function(e) {
  e.preventDefault();

  const content = inputContent.value.trim();
  const description = inputDescription.value.trim();
  const complete = parseInt(inputStatus.value, 10); // 0 / 1 / 2

  if (!content) {
    alert("Podaj nazwę zadania");
    return;
  }
  if (!selectedStart) {
    alert("Najpierw kliknij w kalendarz, żeby wybrać godzinę");
    return;
  }

  const isEdit = !!editingEvent;
  const url = isEdit
    ? `/api/tasks/${editingEvent.id}/edit`
    : `/api/tasks/create`;

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: content,
      description: description,
      start: selectedStart,
      end: selectedEnd,
      complete: complete   // 👈 to wysyłamy
    })
  })
  .then(res => {
    if (!res.ok) {
      return res.text().then(t => { throw new Error(t || "Błąd HTTP"); });
    }
    refreshOverdueEvents();
    return res.json();
  })
  .then(data => {
    // DLA PEWNOŚCI: zobacz co backend zwraca
    // console.log("TASK RESPONSE", data);

if (isEdit) {
      // EDYCJA
      editingEvent.setProp("title", data.title || content); // Użyj content z inputa, jeśli data.title jest puste
      
      // Tutaj kluczowe poprawki (fallbacks):
      editingEvent.setExtendedProp("description", data.description || description);
      editingEvent.setExtendedProp("content", data.content || content);
      editingEvent.setExtendedProp("complete", data.complete ?? complete);

      const newStart = data.start || selectedStart;
      const newEnd = data.end || selectedEnd;
      editingEvent.setDates(newStart, newEnd);
      
      updateEventOverdueStyling(editingEvent);
    } else {
      // TWORZENIE NOWEGO
      const newEvent = calendar.addEvent({
        id: data.id, // ID musi przyjść z bazy, tu nie ma fallbacka
        title: data.title || content, // Jeśli backend nie zwróci title, weź content z formularza
        start: data.start || selectedStart,
        end: data.end || selectedEnd,
        // WAŻNE: Dodaj classNames od razu tutaj, żeby kolor wskoczył bez czekania na funkcje pomocnicze
        classNames: complete === 2 ? ['fc-event-complete'] : [], 
        extendedProps: {
          // Tu jest Twój problem - jeśli backend nie zwróci description, wstawiamy to z formularza:
          description: data.description || description, 
          content: data.content || content,
          complete: data.complete ?? complete
        }
      });
      
      // Odpal stylizację (czerwony kolor) ręcznie dla nowego obiektu
      updateEventOverdueStyling(newEvent);
    }

    refreshOverdueEvents();
    closeCreateTaskModal();
    editingEvent = null;
  })
  .catch(err => {
    console.error(err);
    alert("Błąd sieci / zapisu zadania");
  });
});
  });