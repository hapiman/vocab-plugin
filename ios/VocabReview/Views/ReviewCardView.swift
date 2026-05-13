import UIKit

final class ReviewCardView: UIView {
    private let wordLabel = UILabel()
    private let phoneticLabel = UILabel()
    private let contextLabel = UILabel()
    private let definitionTitleLabel = UILabel()
    private let definitionLabel = UILabel()
    private let masteredBadge = UILabel()
    private let backContextLabel = UILabel()

    private let frontContainer = UIView()
    private let backContainer = UIView()
    private var isShowingAnswer = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    func configure(word: String, info: VocabWord, answerVisible: Bool) {
        wordLabel.text = word
        phoneticLabel.text = info.phonetic

        let sentence = info.latestSentence.isEmpty ? "没有保存例句。" : info.latestSentence
        let highlighted = Self.highlightWord(word, in: sentence)
        contextLabel.attributedText = highlighted
        backContextLabel.attributedText = highlighted

        definitionLabel.text = info.definition?.isEmpty == false ? info.definition : "暂无释义。"

        // Show mastered state
        let isMastered = info.status == "mastered"
        masteredBadge.isHidden = !isMastered
        if isMastered {
            layer.borderWidth = 2
            layer.borderColor = Theme.Colors.statMastered.withAlphaComponent(0.5).cgColor
        } else {
            layer.borderWidth = 0
            layer.borderColor = nil
        }

        if answerVisible && !isShowingAnswer {
            flipToAnswer()
        } else if !answerVisible && isShowingAnswer {
            flipToFront()
        } else {
            frontContainer.isHidden = answerVisible
            backContainer.isHidden = !answerVisible
            isShowingAnswer = answerVisible
        }
    }

    func flipToAnswer() {
        isShowingAnswer = true
        UIView.transition(from: frontContainer, to: backContainer,
                          duration: 0.4,
                          options: [.transitionFlipFromRight, .showHideTransitionViews])
    }

    func flipToFront() {
        isShowingAnswer = false
        UIView.transition(from: backContainer, to: frontContainer,
                          duration: 0.4,
                          options: [.transitionFlipFromLeft, .showHideTransitionViews])
    }

    private func resetToFront() {
        isShowingAnswer = false
        frontContainer.isHidden = false
        backContainer.isHidden = true
    }

    private static func highlightWord(_ word: String, in sentence: String) -> NSAttributedString {
        let attr = NSMutableAttributedString(
            string: sentence,
            attributes: [
                .font: UIFont.italicSystemFont(ofSize: 16),
                .foregroundColor: UIColor.secondaryLabel
            ]
        )
        // Case-insensitive search for the word
        let searchRange = NSRange(sentence.startIndex..., in: sentence)
        var range = (sentence as NSString).range(of: word, options: .caseInsensitive, range: searchRange)
        while range.location != NSNotFound {
            attr.addAttributes([
                .font: UIFont.systemFont(ofSize: 16, weight: .bold),
                .foregroundColor: Theme.Colors.accent
            ], range: range)
            let nextStart = range.location + range.length
            if nextStart >= sentence.count { break }
            let remaining = NSRange(location: nextStart, length: sentence.count - nextStart)
            range = (sentence as NSString).range(of: word, options: .caseInsensitive, range: remaining)
        }
        return attr
    }

    private func setup() {
        backgroundColor = Theme.Colors.cardBackground
        layer.cornerRadius = Theme.Radius.large
        Theme.applyCardShadow(to: layer)

        setupFrontSide()
        setupBackSide()
        setupMasteredBadge()

        backContainer.isHidden = true
    }

    private func setupMasteredBadge() {
        masteredBadge.text = " \u{2713} 已掌握 "
        masteredBadge.font = UIFont.systemFont(ofSize: 12, weight: .semibold)
        masteredBadge.textColor = Theme.Colors.statMastered
        masteredBadge.backgroundColor = Theme.Colors.statMastered.withAlphaComponent(0.12)
        masteredBadge.layer.cornerRadius = 8
        masteredBadge.clipsToBounds = true
        masteredBadge.isHidden = true
        masteredBadge.translatesAutoresizingMaskIntoConstraints = false
        addSubview(masteredBadge)

        NSLayoutConstraint.activate([
            masteredBadge.topAnchor.constraint(equalTo: topAnchor, constant: Theme.Spacing.md),
            masteredBadge.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -Theme.Spacing.md),
            masteredBadge.heightAnchor.constraint(equalToConstant: 24)
        ])
    }

    private func setupFrontSide() {
        wordLabel.font = Theme.Font.wordDisplay
        wordLabel.textColor = .label
        wordLabel.numberOfLines = 0
        wordLabel.adjustsFontSizeToFitWidth = true
        wordLabel.minimumScaleFactor = 0.6

        phoneticLabel.font = UIFont.systemFont(ofSize: 15, weight: .medium)
        phoneticLabel.textColor = Theme.Colors.subtleText

        let contextTitleLabel = UILabel()
        contextTitleLabel.text = "例句"
        contextTitleLabel.font = Theme.Font.caption
        contextTitleLabel.textColor = Theme.Colors.subtleText.withAlphaComponent(0.7)

        contextLabel.font = .italicSystemFont(ofSize: 16)
        contextLabel.textColor = .secondaryLabel
        contextLabel.numberOfLines = 0


        let wordStack = UIStackView(arrangedSubviews: [wordLabel, phoneticLabel])
        wordStack.axis = .vertical
        wordStack.spacing = Theme.Spacing.sm

        let contextStack = UIStackView(arrangedSubviews: [contextTitleLabel, contextLabel])
        contextStack.axis = .vertical
        contextStack.spacing = Theme.Spacing.sm

        let spacer = UIView()

        let stack = UIStackView(arrangedSubviews: [wordStack, contextStack, spacer])
        stack.axis = .vertical
        stack.spacing = Theme.Spacing.xl
        stack.translatesAutoresizingMaskIntoConstraints = false

        frontContainer.translatesAutoresizingMaskIntoConstraints = false
        addSubview(frontContainer)
        frontContainer.addSubview(stack)

        NSLayoutConstraint.activate([
            frontContainer.topAnchor.constraint(equalTo: topAnchor),
            frontContainer.leadingAnchor.constraint(equalTo: leadingAnchor),
            frontContainer.trailingAnchor.constraint(equalTo: trailingAnchor),
            frontContainer.bottomAnchor.constraint(equalTo: bottomAnchor),

            stack.topAnchor.constraint(equalTo: frontContainer.topAnchor, constant: Theme.Spacing.xxl),
            stack.leadingAnchor.constraint(equalTo: frontContainer.leadingAnchor, constant: Theme.Spacing.xxl),
            stack.trailingAnchor.constraint(equalTo: frontContainer.trailingAnchor, constant: -Theme.Spacing.xxl),
            stack.bottomAnchor.constraint(equalTo: frontContainer.bottomAnchor, constant: -Theme.Spacing.xxl)
        ])
    }

    private func setupBackSide() {
        let backWordLabel = UILabel()
        backWordLabel.font = Theme.Font.title
        backWordLabel.textColor = .label
        backWordLabel.numberOfLines = 0

        definitionTitleLabel.text = "释义"
        definitionTitleLabel.font = Theme.Font.caption
        definitionTitleLabel.textColor = Theme.Colors.subtleText.withAlphaComponent(0.7)

        definitionLabel.font = UIFont.systemFont(ofSize: 18, weight: .medium)
        definitionLabel.textColor = .label
        definitionLabel.numberOfLines = 0

        let defStack = UIStackView(arrangedSubviews: [definitionTitleLabel, definitionLabel])
        defStack.axis = .vertical
        defStack.spacing = Theme.Spacing.sm

        // Reuse context on back too
        let backContextTitle = UILabel()
        backContextTitle.text = "例句"
        backContextTitle.font = Theme.Font.caption
        backContextTitle.textColor = Theme.Colors.subtleText.withAlphaComponent(0.7)

        backContextLabel.font = .italicSystemFont(ofSize: 16)
        backContextLabel.textColor = .secondaryLabel
        backContextLabel.numberOfLines = 0

        let contextStack = UIStackView(arrangedSubviews: [backContextTitle, backContextLabel])
        contextStack.axis = .vertical
        contextStack.spacing = Theme.Spacing.sm

        let stack = UIStackView(arrangedSubviews: [defStack, contextStack])
        stack.axis = .vertical
        stack.spacing = Theme.Spacing.xl
        stack.translatesAutoresizingMaskIntoConstraints = false

        backContainer.translatesAutoresizingMaskIntoConstraints = false
        addSubview(backContainer)
        backContainer.addSubview(stack)

        // Content is set dynamically in configure()

        NSLayoutConstraint.activate([
            backContainer.topAnchor.constraint(equalTo: topAnchor),
            backContainer.leadingAnchor.constraint(equalTo: leadingAnchor),
            backContainer.trailingAnchor.constraint(equalTo: trailingAnchor),
            backContainer.bottomAnchor.constraint(equalTo: bottomAnchor),

            stack.topAnchor.constraint(equalTo: backContainer.topAnchor, constant: Theme.Spacing.xxl),
            stack.leadingAnchor.constraint(equalTo: backContainer.leadingAnchor, constant: Theme.Spacing.xxl),
            stack.trailingAnchor.constraint(equalTo: backContainer.trailingAnchor, constant: -Theme.Spacing.xxl),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: backContainer.bottomAnchor, constant: -Theme.Spacing.xxl)
        ])
    }
}
