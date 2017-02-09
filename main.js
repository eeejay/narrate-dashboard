document.getElementById("channel").addEventListener("change", onChannelChanged);
function onChannelChanged(evt) {
  location.hash = evt.target.value;
  main();
}

var versions = {};

function codeToName(code) {
  return (isoLangs[code] || { name: code }).name;
}
var bar;
function populateTopLangs(rawStats) {
  stats = rawStats.slice();
  stats.sort((a, b) => a.readerModeCount - b.readerModeCount);
  stats = stats.slice(stats.length - 16);
  let data = {
    labels: stats.map(s => `${s.label}`),
    series: [
      {
        name: "Narrate Supported",
        data: stats.map(s => {
          return {
            value: s.narrateSuccess,
            meta: (s.narrateSuccess * 100 / s.readerModeCount).toFixed(2) +
              "% Narrate supported"
          };
        })
      },
      {
        name: "Narrate Unsupported",
        data: stats.map(s => {
          return {
            value: s.narrateFail,
            meta: (s.narrateFail * 100 / s.readerModeCount).toFixed(2) +
              "% Narrate unsupported"
          };
        })
      }
    ]
  };
  console.log("w", stats);
  new Chartist.Bar("#topLangs .ct-chart", data, {
    horizontalBars: true,
    reverseData: false,
    stackBars: true,
    axisX: {
      labelInterpolationFnc: function(value) {
        return value / 1000 + "k";
      }
    },
    axisY: { position: "end" },
    plugins: [
      Chartist.plugins.tooltip(),
      Chartist.plugins.ctAccessibility({
        caption: "Reader Mode content language distribution",
        seriesHeader: "",
        summary: "The first row is the success count for initializing Narrate, the second row is the failure count"
      })
    ]
  }).on("draw", function(data) {
    if (data.type === "bar") {
      data.element.attr({ style: "stroke-width: 15px" });
    }
  });
}

function populateFailedLangs(stats, cutoff = 14) {
  let pieData = stats.slice().sort((a, b) => b.narrateFail - a.narrateFail);
  let other = pieData.slice(cutoff).reduce((a, b) => {
    return {
      label: a.label,
      narrateFail: a.narrateFail + b.narrateFail,
      narrateFailShare: a.narrateFailShare + b.narrateFailShare
    };
  }, { label: "Other", narrateFail: 0, narrateFailShare: 0 });
  pieData.splice(cutoff, pieData.length - cutoff, other);
  console.log(pieData);

  let data = {
    labels: pieData.map(
      l => `${l.label} (${(l.narrateFailShare * 100).toFixed(1)}%)`
    ),
    series: pieData.map(l => l.narrateFail)
  };
  var options = {
    plugins: [
      Chartist.plugins.ctAccessibility({
        caption: "Distribution of most underserved languages",
        seriesHeader: "",
        summary: ""
      })
    ]
  };
  var responsiveOptions = [
    [
      "screen and (min-width: 640px)",
      {
        chartPadding: 30,
        labelOffset: 100,
        labelDirection: "explode",
        labelInterpolationFnc: function(value) {
          return value;
        }
      }
    ],
    [
      "screen and (min-width: 1024px)",
      { labelOffset: 120, labelDirection: "explode", chartPadding: 20 }
    ]
  ];

  new Chartist.Pie("#topFails .ct-chart", data, options, responsiveOptions);
}

function hd(v) {
  return humanizeDuration(v, { round: true });
}

function populateNarrateSpeakTime(stats) {
  let series = stats.values.slice(1);
  let labels = stats.buckets.slice(1);
  let total = series.reduce((a, b) => a + b);
  let data = {
    labels,
    series: [
      series.map((v, i) => {
        return { value: v / total * 100, meta: "Over " + hd(labels[i]) };
      })
    ]
  };

  new Chartist.Bar("#narrateSpeakTime .ct-chart", data, {
    reverseData: false,
    axisX: {
      labelInterpolationFnc: function(v) {
        console.log(v);
        let seconds = Math.round(v / 1000);
        if (seconds && seconds % 5 == 0) {
          return `${new Date(v).toLocaleFormat("%M:%S")}`;
        }
        return null;
      }
    },
    axisY: {
      labelInterpolationFnc: function(v) {
        return `${v.toFixed(0)}%`;
      }
    },
    plugins: [
      Chartist.plugins.tooltip({
        transformTooltipTextFnc: v => {
          return `${Number(v).toFixed(2)}%`;
        }
      }),
      Chartist.plugins.ctAccessibility({
        caption: "Reader Mode Speaking Times",
        seriesHeader: "",
        summary: ""
      })
    ]
  }).on("draw", function(data) {
    if (data.type === "bar") {
      data.element.attr({ style: "stroke-width: 15px" });
    }
  });
}

function currentVersions() {
  var nightly = Number(
    Telemetry
      .getVersions()
      .filter(version => version.startsWith("nightly"))
      .map(versionString => versionString.split("/")[(1)])
      .sort((a, b) => a - b)
      .pop()
  );
  return {
    nightly: nightly + "",
    aurora: nightly - 1 + "",
    beta: nightly - 2 + "",
    release: nightly - 3 + ""
  };
}

function evolutionToStats(evolution) {
  let entries = Object.entries(evolution);
  let totalReaderUsage = entries.reduce(
    (a, b) => {
      return a + b[(1)].histogram().values[(0)];
    },
    0
  );
  let totalNarrateFails = entries.reduce(
    (a, b) => {
      let h = b[(1)].histogram();
      return a + (h.values[(0)] - h.values[(1)]);
    },
    0
  );

  return entries.map(([ lang, val ]) => {
    let values = val.histogram().values;
    let readerModeCount = values[(0)];
    let readerModeShare = values[(0)] / totalReaderUsage;
    let narrateSuccess = values[(1)];
    let narrateFail = values[(0)] - values[(1)];
    let narrateFailShare = narrateFail / totalNarrateFails;
    let label = codeToName(lang);
    return {
      lang,
      label,
      readerModeCount,
      readerModeShare,
      narrateSuccess,
      narrateFail,
      narrateFailShare
    };
  });
}

function statsToCSV(stats) {
  let keys = [ "lang", "readerModeCount", "narrateFail" ];
  return keys.map(k => JSON.stringify(k)).join(",") + "\n" + stats.map(stat => {
      return keys.map(k => JSON.stringify(stat[k])).join(",");
    }).join("\n");
}

let initPromise = new Promise(resolve => {
  Telemetry.init(resolve);
});

function getEvolution(channel, metric) {
  var version = currentVersions()[channel];
  return new Promise(resolve => {
    Telemetry.getEvolution(channel, version, metric, {}, false, resolve);
  });
}

function main() {
  document.body.classList.add("loading");
  var channel = location.hash
    ? location.hash.substr(1)
    : document.getElementById("channel").value;
  initPromise.then(() => {
    Promise
      .all([
        getEvolution(channel, "NARRATE_CONTENT_BY_LANGUAGE_2"),
        getEvolution(channel, "NARRATE_CONTENT_SPEAKTIME_MS")
      ])
      .then(([ evoLang, evoSpeakTime ]) => {
        document.body.classList.remove("loading");

        let stats = evolutionToStats(evoLang);
        let csvlink = document.getElementById("csvlink");
        csvlink.href = "data:text/csv," + encodeURIComponent(statsToCSV(stats));
        csvlink.hidden = false;
        populateTopLangs(stats);
        populateFailedLangs(stats);

        populateNarrateSpeakTime(evoSpeakTime[""].histogram());
      });
  });
}

main();
