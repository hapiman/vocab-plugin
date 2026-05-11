import UIKit

final class ReviewViewController: UIViewController {
    private let store = VocabStore.shared
    private let cardView = ReviewCardView()
    private let emptyView = EmptyStateView()
    private let showAnswerButton = UIButton(type: .system)
    private let actionStack = UIStackView()

    private var queue: [(String, VocabWord)] = []
    private var currentIndex = 0
    private var answerVisible = false

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "复习"
        view.backgroundColor = .systemBackground
        setupViews()
        reloadQueue()
    }

    private func setupViews() {
        cardView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cardView)

        emptyView.configure(title: "暂无到期单词", message: "PC 浏览器扩展收词后，手机端会从 Gist 同步复习队列。")
        emptyView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(emptyView)

        showAnswerButton.setTitle("显示答案", for: .normal)
        showAnswerButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        showAnswerButton.backgroundColor = .systemBlue
        showAnswerButton.tintColor = .white
        showAnswerButton.layer.cornerRadius = 8
        showAnswerButton.addTarget(self, action: #selector(showAnswer), for: .touchUpInside)

        actionStack.axis = .horizontal
        actionStack.distribution = .fillEqually
        actionStack.spacing = 8
        actionStack.isHidden = true

        [
            ("忘了", ReviewOutcome.miss),
            ("模糊", ReviewOutcome.hard),
            ("记得", ReviewOutcome.good)
        ].forEach { title, outcome in
            let button = makeActionButton(title: title)
            button.addAction(UIAction { [weak self] _ in
                self?.complete(outcome)
            }, for: .touchUpInside)
            actionStack.addArrangedSubview(button)
        }

        let skipButton = makeSecondaryButton(title: "跳过")
        skipButton.addTarget(self, action: #selector(skipWord), for: .touchUpInside)

        let masteredButton = makeSecondaryButton(title: "已掌握")
        masteredButton.addTarget(self, action: #selector(masterWord), for: .touchUpInside)

        let bottomStack = UIStackView(arrangedSubviews: [
            showAnswerButton,
            actionStack,
            skipButton,
            masteredButton
        ])
        bottomStack.axis = .vertical
        bottomStack.spacing = 12
        bottomStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bottomStack)

        NSLayoutConstraint.activate([
            cardView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 18),
            cardView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            cardView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            cardView.bottomAnchor.constraint(equalTo: bottomStack.topAnchor, constant: -18),

            emptyView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            emptyView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            emptyView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            emptyView.bottomAnchor.constraint(equalTo: bottomStack.topAnchor),

            bottomStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            bottomStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            bottomStack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),

            showAnswerButton.heightAnchor.constraint(equalToConstant: 48),
            skipButton.heightAnchor.constraint(equalToConstant: 44),
            masteredButton.heightAnchor.constraint(equalToConstant: 44),
            actionStack.heightAnchor.constraint(equalToConstant: 44)
        ])
    }

    private func reloadQueue() {
        queue = store.sortedDueQueue
        currentIndex = 0
        answerVisible = false
        renderCurrent()
    }

    private func renderCurrent() {
        guard currentIndex < queue.count else {
            cardView.isHidden = true
            emptyView.isHidden = false
            showAnswerButton.isHidden = true
            actionStack.isHidden = true
            return
        }

        let item = queue[currentIndex]
        cardView.isHidden = false
        emptyView.isHidden = true
        showAnswerButton.isHidden = answerVisible
        actionStack.isHidden = !answerVisible
        cardView.configure(word: item.0, info: item.1, answerVisible: answerVisible)
    }

    private func makeActionButton(title: String) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
        button.backgroundColor = .systemBlue
        button.tintColor = .white
        button.layer.cornerRadius = 8
        return button
    }

    private func makeSecondaryButton(title: String) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
        button.backgroundColor = .secondarySystemBackground
        button.layer.cornerRadius = 8
        return button
    }

    @objc private func showAnswer() {
        answerVisible = true
        renderCurrent()
    }

    @objc private func skipWord() {
        complete(.skip)
    }

    @objc private func masterWord() {
        complete(.mastered)
    }

    private func complete(_ outcome: ReviewOutcome) {
        guard currentIndex < queue.count else { return }
        let word = queue[currentIndex].0
        _ = store.applyReview(word: word, outcome: outcome)
        currentIndex += 1
        answerVisible = false
        renderCurrent()
    }
}
