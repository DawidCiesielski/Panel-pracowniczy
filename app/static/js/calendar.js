document.addEventListener("DOMContentLoaded", function() {
    
    // 1. POBIERANIE TOKENA CSRF
    // Szukamy inputa, którego dodałeś w HTML. Dzięki temu działa to globalnie.
    const csrfTokenInput = document.querySelector('input[name="csrf_token"]');
    const csrfToken = csrfTokenInput ? csrfTokenInput.value : '';

    const calendarEl = document.getElementById("calendar");
    
    function isMobile() {
      return window.innerWidth < 768;
    }

    function getInitialView() {
      return isMobile() ? 'timeGridDay' : 'timeGridWeek';
    }

    // ---- ELEMENTY DOM ----
    const createTaskModal = document.getElementById("createTaskModal");
    const createTaskModalClose = document.getElementById("createTaskModalClose");
    const createTaskForm = document.getElementById("createTaskForm");
    
    const inputContent = document.getElementById("content");
    const inputStatus = document.getElementById("complete");
    const inputDescription = document.getElementById("description");

    const deleteTaskModal = document.getElementById("deleteTaskModal");
    const deleteTaskText = document.getElementById("deleteTaskText");
    const confirmDeleteTask = document.getElementById("confirmDeleteTask");
    const cancelDeleteTask = document.getElementById("cancelDeleteTask");

    // Zmienne pomocnicze
    let selectedStart = null;
    let selectedEnd = null;
    let editingEvent = null;
    let eventToDelete = null;

    // ---- FUNKCJE MODALI ----

    function openDeleteTaskModal(event) {
      eventToDelete = event;
      // Bezpieczne wstawianie tekstu (textContent zamiast innerHTML)
      deleteTaskText.textContent = `Czy na pewno chcesz usunąć zadanie: "${event.title || 'bez nazwy'}"?`;
      deleteTaskModal.classList.remove("hidden");
    }

    function closeDeleteTaskModal() {
      deleteTaskModal.classList.add("hidden");
      eventToDelete = null;
    }

    cancelDeleteTask.addEventListener("click", closeDeleteTaskModal);
    deleteTaskModal.addEventListener("click", (e) => {
      if (e.target === deleteTaskModal) closeDeleteTaskModal();
    });

    function openCreateTaskModal() {
      editingEvent = null; // tryb tworzenia
      document.querySelector("#createTaskModal h2").textContent = "Dodaj zadanie";
      document.getElementById("btn_add").value = "Utwórz zadanie";

      inputContent.value = "";
      inputDescription.value = "";
      inputStatus.value = "0";
      createTaskModal.classList.remove("hidden");
    }

    function openEditTaskModal(event) {
      editingEvent = event;
      document.querySelector("#createTaskModal h2").textContent = "Edytuj zadanie";
      document.getElementById("btn_add").value = "Zapisz zmiany";

      // Pobieranie danych z bezpiecznym fallbackiem
      const contentVal = event.extendedProps.content || event.title || "";
      const descVal = event.extendedProps.description || event.description || "";
      const statusVal = event.extendedProps.complete ?? 0;

      inputContent.value = contentVal;
      inputDescription.value = descVal;
      inputStatus.value = String(statusVal);

      selectedStart = event.startStr;
      selectedEnd = event.endStr;

      createTaskModal.classList.remove("hidden");
    }

    function closeCreateTaskModal() {
      createTaskModal.classList.add("hidden");
    }

    createTaskModalClose.addEventListener("click", closeCreateTaskModal);
    createTaskModal.addEventListener("click", (e) => {
      if (e.target === createTaskModal) closeCreateTaskModal();
    });


    // ---- STYLIZACJA OVERDUE (CZERWONE ZADANIA) ----
    function updateEventOverdueStyling(event) {
      if (!event) return;

      const complete = (event.extendedProps && event.extendedProps.complete) ?? event.complete ?? 0;
      const now = new Date();
      const end = event.end || event.start;
      const isOverdue = complete !== 2 && end && end < now;

      let classes = event.classNames ? [...event.classNames] : [];
      classes = classes.filter(c => c !== "fc-event-overdue" && c !== "fc-event-complete");

      if (isOverdue) {
        classes.push("fc-event-overdue");
      } else if (complete === 2) {
        classes.push("fc-event-complete");
      }

      event.setProp("classNames", classes);
    }

    function refreshOverdueEvents() {
      const events = calendar.getEvents();
      events.forEach(updateEventOverdueStyling);
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
      slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: isMobile() ? 'timeGridDay,listWeek' : 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      buttonText: { today: 'Dziś', month: 'Miesiąc', week: 'Tydzień', day: 'Dzień' },

      editable: true,
      eventDurationEditable: true,
      events: "/api/tasks/all",
      selectable: true,
      selectMirror: true,
      unselectAuto: true,

      // Kliknięcie w puste miejsce -> Dodawanie
      dateClick: function(info) {
        selectedStart = info.dateStr;
        selectedEnd = null;
        openCreateTaskModal();
      },

      // Renderowanie eventu (dodanie przycisku X)
      eventDidMount: function(info) {
        if (info.view.type.indexOf('list') === 0) {
          info.el.style.position = 'relative';
        }
        const btn = document.createElement("button");
        btn.className = "event-delete-btn";
        btn.innerHTML = "&times;";

        btn.addEventListener("click", function(e) {
          e.stopPropagation();
          openDeleteTaskModal(info.event);
        });
        info.el.appendChild(btn);
        updateEventOverdueStyling(info.event);
      },

      // Kliknięcie w event (Edycja lub Duplikacja)
      eventClick: function(info) {
        // ALT + CLICK -> DUPLIKACJA
        if (info.jsEvent.altKey) {
          info.jsEvent.preventDefault();
          info.jsEvent.stopPropagation();

          fetch(`/api/tasks/${info.event.id}/duplicate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": csrfToken // <--- TOKEN CSRF
            },
            body: JSON.stringify({})
          })
          .then(res => {
            if (!res.ok) return res.text().then(t => { throw new Error(t || "Błąd HTTP"); });
            return res.json();
          })
          .then(data => {
            const newEvent = calendar.addEvent({
              id: data.id,
              title: data.title,
              start: data.start,
              end: data.end,
              complete: data.complete,
              extendedProps: {
                description: data.description,
                content: data.content,
                complete: data.complete
              }
            });
            updateEventOverdueStyling(newEvent);
          })
          .catch(err => {
            console.error(err);
            alert("Nie udało się zduplikować zadania");
          });
          return;
        }

        // ZWYKŁY CLICK -> EDYCJA
        openEditTaskModal(info.event);
      },

      // Przesuwanie (Drag & Drop)
      eventDrop: function (info) {
        const event = info.event;
        fetch(`/api/tasks/${event.id}/move`, {
          method: "POST",
          headers: { 
              "Content-Type": "application/json",
              "X-CSRFToken": csrfToken // <--- TOKEN CSRF
          },
          body: JSON.stringify({
            start: event.startStr,
            end: event.endStr
          })
        }).then(response => {
          if (!response.ok) {
            alert("Błąd przy zapisie daty zadania");
            info.revert();
          } else {
            updateEventOverdueStyling(event);
          }
        }).catch(err => {
          console.error(err);
          alert("Błąd sieci");
          info.revert();
        });
      },

      // Zmiana rozmiaru (Resize)
      eventResize: function (info) {
        const event = info.event;
        fetch(`/api/tasks/${event.id}/resize`, {
          method: "POST",
          headers: { 
              "Content-Type": "application/json",
              "X-CSRFToken": csrfToken // <--- TOKEN CSRF
          },
          body: JSON.stringify({
            start: event.startStr,
            end: event.endStr
          })
        }).then(res => {
          if (!res.ok) {
            alert("Błąd przy zmianie długości zadania");
            info.revert();
          } else {
            updateEventOverdueStyling(event);
          }
        }).catch(err => {
          console.error(err);
          alert("Błąd sieci");
          info.revert();
        });
      },

      select: function(info) {
        selectedStart = info.startStr;
        selectedEnd = info.endStr;
        openCreateTaskModal();
      }
    });
    
    calendar.render();

    window.addEventListener('resize', function () {
      const newView = getInitialView();
      if (calendar.view.type !== newView) {
        calendar.changeView(newView);
      }
    });

    // Odśwież kolory na start
    refreshOverdueEvents();


    // ---- USUWANIE ZADANIA ----
    confirmDeleteTask.addEventListener("click", function() {
        if (!eventToDelete) return;

        const id = eventToDelete.id;

        fetch(`/api/tasks/${id}/delete`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken // <--- TOKEN CSRF
            },
            body: JSON.stringify({})
        })
        .then(res => {
            if (!res.ok) return res.text().then(t => { throw new Error(t || "Błąd HTTP"); });
            eventToDelete.remove();
            refreshOverdueEvents();
            closeDeleteTaskModal();
        })
        .catch(err => {
            console.error(err);
            alert("Nie udało się usunąć zadania");
        });
    });


    // ---- DODAWANIE / EDYCJA (SUBMIT) ----
    createTaskForm.addEventListener("submit", function(e) {
        e.preventDefault();

        const content = inputContent.value.trim();
        const description = inputDescription.value.trim();
        const complete = parseInt(inputStatus.value, 10); 

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
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken // <--- TOKEN CSRF
            },
            body: JSON.stringify({
                content: content,
                description: description,
                start: selectedStart,
                end: selectedEnd,
                complete: complete 
            })
        })
        .then(res => {
            if (!res.ok) return res.text().then(t => { throw new Error(t || "Błąd HTTP"); });
            return res.json();
        })
        .then(data => {
            // TUTAJ JEST NAPRAWA: Jeśli backend nie zwróci pola, bierzemy z formularza
            if (isEdit) {
                editingEvent.setProp("title", data.title || content);
                editingEvent.setExtendedProp("description", data.description || description);
                editingEvent.setExtendedProp("content", data.content || content);
                editingEvent.setExtendedProp("complete", data.complete ?? complete);

                const newStart = data.start || selectedStart;
                const newEnd = data.end || selectedEnd;
                editingEvent.setDates(newStart, newEnd);
                
                updateEventOverdueStyling(editingEvent);
            } else {
                const newEvent = calendar.addEvent({
                    id: data.id,
                    title: data.title || content,
                    start: data.start || selectedStart,
                    end: data.end || selectedEnd,
                    classNames: complete === 2 ? ['fc-event-complete'] : [],
                    extendedProps: {
                        description: data.description || description,
                        content: data.content || content,
                        complete: data.complete ?? complete
                    }
                });
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